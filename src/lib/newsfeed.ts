import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { DISTRICTS, normalizeDistrict } from '@/lib/districts';
import { embedText } from '@/lib/ai';

/**
 * Haber kaynağı toplama (ingestion): RSS / Google News feed'lerini çeker,
 * öğeleri ayrıştırır, tekilleştirir (guidHash) ve FeedItem olarak saklar.
 * AI gerektirmez — tamamen deterministik. (Kümeleme kısmı hariç: embedding üretimi
 * için AI istemcisi kullanılır ama hata-toleranslıdır — bkz. clusterRecentItems.)
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* ── Ucuz coğrafi/ilçe tespiti + Çanakkale-dışı gürültü filtresi (AI'sız) ── */

/** Türkçe karakterleri ASCII köküne indirger (eşleme için). */
function fold(s: string): string {
  return (s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/i̇/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
}

// İlçe adının folded hali → slug (TAM token eşlemesi; "çanakkale" içinde "çan" gibi
// yanlış eşleşmeleri önlemek için substring DEĞİL kelime eşlemesi kullanılır).
const NAME_FOLD_TO_SLUG = new Map<string, string>(DISTRICTS.map((d) => [fold(d.name), d.slug]));

// Çanakkale ile ilgiyi (isLocal) gösteren ipuçları — ilçe dışı belde/mevki/kurum adları
// dahil (yalnızca isLocal için; ilçe ATAMAZ). Hepsi folded (ascii) tutulur.
const CANAKKALE_HINTS = [
  'canakkale', 'bozcaada', 'truva', 'troya', 'kilitbahir', 'assos', 'geyikli', 'kepez',
  'intepe', 'kumkale', 'dardanos', 'comu', 'onsekiz mart', '18 mart', 'gelibolu yarimadasi',
  'kazdagi', 'kaz daglari', 'kucukkuyu', 'gulpinar', 'yenikoy',
];

/** Metinden (başlık+özet) Çanakkale ilçesini ve yerel olup olmadığını çıkarır.
 *  Kaynağın kendi türü/ilçesi düşük-sinyalli öğelerde geri-plan (fallback) sağlar. */
function detectGeo(
  text: string,
  source: { sourceType?: string | null; type?: string | null; district?: string | null },
): { district: string | null; isLocal: boolean } {
  const folded = fold(text);
  let district: string | null = null;
  for (const tok of folded.split(/[^a-z0-9]+/)) {
    if (!tok) continue;
    const slug = NAME_FOLD_TO_SLUG.get(tok);
    if (slug) { district = slug; break; }
  }
  const hasHint = district !== null || CANAKKALE_HINTS.some((h) => folded.includes(h));
  let isLocal: boolean;
  if (hasHint) {
    isLocal = true;
  } else if (source.sourceType === 'aggregator' || source.sourceType === 'social' || source.type === 'google_news') {
    // Agregatör/sosyal + Çanakkale ipucu yok → büyük olasılıkla ulusal gürültü
    isLocal = false;
  } else {
    // Saf yerel/resmi Çanakkale kaynağı → varsayılan yerel
    isLocal = true;
  }
  if (!district && source.district) district = normalizeDistrict(source.district);
  return { district, isLocal };
}

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
        // Ucuz coğrafi tespit (AI'sız): ilçe + Çanakkale-dışı gürültü bayrağı
        const geo = detectGeo(`${it.title} ${it.summary ?? ''}`, src);
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
              district: geo.district,
              isLocal: geo.isLocal,
            },
          });
          created++;
        } catch {
          /* guidHash unique çakışması = zaten var, atla */
        }
      }
      // Kaynak sağlığı: son çekim zamanı + öğe sayısı, hata temizle
      await prisma.newsSource.update({
        where: { id: src.id },
        data: { lastFetchedAt: new Date(), lastItemCount: items.length, lastError: null },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'bilinmeyen hata';
      errors.push(`${src.name}: ${msg}`);
      // Kaynak sağlığı: hatayı kaydet (izleme/UI için) — güncelleme de patlarsa sessizce geç
      try {
        await prisma.newsSource.update({
          where: { id: src.id },
          data: { lastFetchedAt: new Date(), lastError: msg.slice(0, 500) },
        });
      } catch { /* yoksay */ }
    }
  }
  return { fetched, created, errors };
}

/** FeedItem ile kaynağın güven bağlamını (konu seçimi için) getiren ortak join. */
export const SOURCE_TRUST_SELECT = { select: { trustScore: true, sourceType: true, district: true } } as const;

/** Son N gün içindeki, henüz taslakta kullanılmamış öğeler (konu bulma girdisi).
 *  Kaynağın güven skoru/türü/ilçesi de join edilir (ağırlıklı konu seçimi için). */
export async function recentUnusedItems(days = 3, limit = 120) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.feedItem.findMany({
    where: { usedInDraft: false, OR: [{ pubDate: { gte: since } }, { pubDate: null, fetchedAt: { gte: since } }] },
    orderBy: { fetchedAt: 'desc' },
    take: limit,
    include: { source: SOURCE_TRUST_SELECT },
  });
}

/* ── Çoklu-kaynak teyidi: embedding kümeleme (greedy cosine) ── */

/** İki vektör arası kosinüs benzerliği (0-1; boş/uyumsuz vektörde 0). */
function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Son N gündeki YEREL öğelere embedding üretir (eksik olanlara) ve greedy kosinüs
 * eşiğiyle (>0.82) aynı olayı anlatanları TEK clusterId altında toplar.
 * Aynı olayın farklı kaynaklardaki tekrarları → çoklu-kaynak teyidi göstergesi.
 *
 * Hata-toleranslı: embedding üretimi patlarsa kümeleme atlanır (skipped:true) ve
 * mevcut davranış korunur — üretim hattı düşmez.
 */
export async function clusterRecentItems(opts?: { days?: number; threshold?: number; limit?: number }): Promise<{
  embedded: number; clusters: number; skipped: boolean; error?: string;
}> {
  const days = opts?.days ?? 3;
  const threshold = opts?.threshold ?? 0.82;
  const limit = opts?.limit ?? 200;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.feedItem.findMany({
    where: { isLocal: true, OR: [{ pubDate: { gte: since } }, { pubDate: null, fetchedAt: { gte: since } }] },
    orderBy: { fetchedAt: 'desc' },
    take: limit,
    select: { id: true, title: true, summary: true, sourceId: true, embedding: true },
  });
  if (rows.length === 0) return { embedded: 0, clusters: 0, skipped: false };

  // Mevcut embedding'leri ayrıştır, eksik olanları topla
  const vectors = new Map<string, number[]>();
  for (const r of rows) {
    if (r.embedding) {
      try {
        const v = JSON.parse(r.embedding);
        if (Array.isArray(v) && v.length > 0) vectors.set(r.id, v);
      } catch { /* bozuk embedding → yeniden üretilecek */ }
    }
  }
  const need = rows.filter((r) => !vectors.has(r.id));
  let embedded = 0;
  if (need.length > 0) {
    let newVecs: number[][];
    try {
      newVecs = await embedText(need.map((r) => `${r.title}\n${r.summary ?? ''}`));
    } catch (e) {
      return { embedded: 0, clusters: 0, skipped: true, error: e instanceof Error ? e.message : 'embedding hatası' };
    }
    for (let i = 0; i < need.length; i++) {
      const v = newVecs[i];
      if (!Array.isArray(v) || v.length === 0) continue;
      vectors.set(need[i].id, v);
      embedded++;
      try {
        await prisma.feedItem.update({ where: { id: need[i].id }, data: { embedding: JSON.stringify(v) } });
      } catch { /* tekil update hatası kümelemeyi bozmasın */ }
    }
  }

  // Greedy kümeleme: her kümeyi ilk (anchor) öğesiyle temsil et; en yüksek benzerlik
  // eşiği aşarsa o kümeye kat, yoksa yeni küme aç. clusterId = anchor öğe id'si.
  type Cluster = { id: string; anchor: number[]; members: string[] };
  const clusters: Cluster[] = [];
  for (const r of rows) {
    const v = vectors.get(r.id);
    if (!v) continue;
    let best: Cluster | null = null;
    let bestSim = threshold;
    for (const c of clusters) {
      const sim = cosine(v, c.anchor);
      if (sim >= bestSim) { bestSim = sim; best = c; }
    }
    if (best) best.members.push(r.id);
    else clusters.push({ id: r.id, anchor: v, members: [r.id] });
  }

  // clusterId'leri yaz (küme başına tek updateMany)
  for (const c of clusters) {
    try {
      await prisma.feedItem.updateMany({ where: { id: { in: c.members } }, data: { clusterId: c.id } });
    } catch { /* yoksay */ }
  }

  return { embedded, clusters: clusters.length, skipped: false };
}
