import crypto from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Haber kaynağı toplama (ingestion): RSS / Google News feed'lerini çeker,
 * öğeleri ayrıştırır, tekilleştirir (guidHash) ve FeedItem olarak saklar.
 * AI gerektirmez — tamamen deterministik.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export type ParsedItem = { title: string; link: string; pubDate: Date | null; summary: string | null; guid: string | null };

/** URL'i tekilleştirme için normalize eder: tracking parametrelerini + hash'i atar, sondaki / kaldırır. */
export function normalizeLink(url: string): string {
  try {
    const u = new URL(url);
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'oc', 'ved', 'ref', 'ref_src']) {
      u.searchParams.delete(k);
    }
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

/** CDATA/HTML etiketlerini temizler. */
function clean(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#8217;/g, '’')
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : undefined;
}

/** RSS/Atom XML'inden öğeleri çıkarır (regex tabanlı, bağımlılık yok). */
export function parseFeed(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) || [];
  for (const block of blocks) {
    const title = clean(tag(block, 'title'));
    // RSS: <link>url</link> ; Atom: <link href="url" />
    let link = clean(tag(block, 'link'));
    if (!link) {
      const hm = block.match(/<link[^>]*href="([^"]+)"/i);
      if (hm) link = hm[1];
    }
    const pubRaw = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date');
    let pubDate: Date | null = null;
    if (pubRaw) {
      const d = new Date(clean(pubRaw));
      if (!isNaN(d.getTime())) pubDate = d;
    }
    const summary = clean(tag(block, 'description') || tag(block, 'summary') || tag(block, 'content')).slice(0, 600) || null;
    // Kararlı tekilleştirme kimliği: RSS <guid> / Atom <id> (varsa)
    const guid = clean(tag(block, 'guid') || tag(block, 'id')) || null;
    if (title && link) items.push({ title, link, pubDate, summary, guid });
  }
  return items;
}

/** Tek bir feed'i çeker + ayrıştırır. */
export async function fetchFeed(feedUrl: string, needsUA = false): Promise<ParsedItem[]> {
  const res = await fetch(feedUrl, {
    headers: needsUA ? { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' } : { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parseFeed(xml);
}

const hashOf = (s: string) => crypto.createHash('sha1').update(s).digest('hex');

/**
 * Etkin tüm kaynakları çeker, yeni (tekil) öğeleri FeedItem olarak saklar.
 * Döner: { fetched, created, errors }.
 */
export async function ingestAllSources(): Promise<{ fetched: number; created: number; errors: string[] }> {
  const sources = await prisma.newsSource.findMany({ where: { enabled: true } });
  let fetched = 0;
  let created = 0;
  const errors: string[] = [];

  for (const src of sources) {
    try {
      const items = await fetchFeed(src.feedUrl, src.needsUA);
      fetched += items.length;
      for (const it of items) {
        // Öncelik: kararlı <guid> → normalize link → başlık (tracking'li URL'ler mükerrer üretmesin)
        const guidHash = hashOf(it.guid || normalizeLink(it.link) || it.title);
        try {
          await prisma.feedItem.create({
            data: {
              sourceId: src.id,
              sourceName: src.name,
              title: it.title.slice(0, 500),
              link: it.link,
              guidHash,
              summary: it.summary,
              pubDate: it.pubDate,
            },
          });
          created++;
        } catch {
          /* guidHash unique çakışması = zaten var, atla */
        }
      }
      await prisma.newsSource.update({ where: { id: src.id }, data: { lastFetchedAt: new Date() } });
    } catch (e) {
      errors.push(`${src.name}: ${e instanceof Error ? e.message : 'bilinmeyen hata'}`);
    }
  }
  return { fetched, created, errors };
}

/** Son N gün içindeki, henüz taslakta kullanılmamış öğeler (konu bulma girdisi). */
export async function recentUnusedItems(days = 3, limit = 120) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.feedItem.findMany({
    where: { usedInDraft: false, OR: [{ pubDate: { gte: since } }, { pubDate: null, fetchedAt: { gte: since } }] },
    orderBy: { fetchedAt: 'desc' },
    take: limit,
  });
}
