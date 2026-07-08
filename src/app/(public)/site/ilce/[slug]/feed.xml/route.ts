import prisma from '@/lib/prisma';
import { getSiteSettings, stripHtml } from '@/lib/site';
import { getDistrict } from '@/lib/districts';

/**
 * İlçe RSS 2.0 kanalı — ilgili ilçenin son 30 yayınlanmış haberi.
 * Kanonik adres: canakkale.network/ilce/[slug]/feed.xml.
 * (site/feed.xml route deseninin ilçe filtreli kopyası.)
 */

const SITE_URL = 'https://canakkale.network';

/**
 * XML 1.0'da geçerli olmayan karakterleri süzer. İzin verilenler:
 * U+0009, U+000A, U+000D, U+0020–U+D7FF, U+E000–U+FFFD, U+10000+.
 * Diğer kontrol karakterleri ve U+FFFE/U+FFFF belgeyi parse edilemez yapar.
 * (Kod noktası döngüsüyle yazıldı ki kaynakta literal kontrol karakteri olmasın.)
 */
function stripInvalidXml(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (
      c === 0x09 ||
      c === 0x0a ||
      c === 0x0d ||
      (c >= 0x20 && c <= 0xd7ff) ||
      (c >= 0xe000 && c <= 0xfffd) ||
      c >= 0x10000
    ) {
      out += ch;
    }
  }
  return out;
}

function esc(s: string): string {
  return stripInvalidXml(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cdata(s: string): string {
  // Önce geçersiz XML karakterlerini süz, sonra CDATA içinde "]]>" dizisini kaçışla
  return `<![CDATA[${stripInvalidXml(s).replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const district = getDistrict(slug);
  if (!district) {
    return new Response('İlçe bulunamadı', { status: 404 });
  }

  const settings = await getSiteSettings();

  let articles: {
    slug: string;
    title: string;
    summary: string | null;
    body: string;
    authorName: string;
    publishedAt: Date | null;
    category: { name: string } | null;
  }[] = [];

  try {
    articles = await prisma.siteArticle.findMany({
      where: { status: 'published', deletedAt: null, district: district.slug },
      orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
      take: 30,
      select: {
        slug: true,
        title: true,
        summary: true,
        body: true,
        authorName: true,
        publishedAt: true,
        category: { select: { name: true } },
      },
    });
  } catch {
    // DB erişilemezse boş kanal döndür
  }

  const lastBuild = articles[0]?.publishedAt || new Date();
  const channelLink = `${SITE_URL}/ilce/${district.slug}`;

  const items = articles
    .map((a) => {
      const link = `${SITE_URL}/haber/${a.slug}`;
      const description = a.summary || stripHtml(a.body, 300);
      return (
        '    <item>\n' +
        `      <title>${cdata(a.title)}</title>\n` +
        `      <link>${esc(link)}</link>\n` +
        `      <guid isPermaLink="true">${esc(link)}</guid>\n` +
        (a.publishedAt ? `      <pubDate>${a.publishedAt.toUTCString()}</pubDate>\n` : '') +
        (a.category ? `      <category>${cdata(a.category.name)}</category>\n` : '') +
        `      <description>${cdata(description)}</description>\n` +
        '    </item>\n'
      );
    })
    .join('');

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '  <channel>\n' +
    `    <title>${cdata(`${settings.title} — ${district.name}`)}</title>\n` +
    `    <link>${esc(channelLink)}</link>\n` +
    `    <description>${cdata(`Çanakkale ${district.name} ilçesinden en güncel haberler.`)}</description>\n` +
    '    <language>tr</language>\n' +
    `    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>\n` +
    `    <atom:link href="${esc(`${channelLink}/feed.xml`)}" rel="self" type="application/rss+xml" />\n` +
    items +
    '  </channel>\n' +
    '</rss>\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300',
    },
  });
}
