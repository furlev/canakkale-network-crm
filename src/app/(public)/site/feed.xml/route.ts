import prisma from '@/lib/prisma';
import { getSiteSettings, stripHtml } from '@/lib/site';

/**
 * feed.xml — RSS 2.0: son 30 yayınlanmış haber.
 * Proxy, canakkale.network/feed.xml isteğini buraya rewrite eder.
 */

const SITE_URL = 'https://canakkale.network';

/**
 * XML 1.0'da yasak kontrol/geçersiz karakterleri süzer.
 * Geçerli: U+0009, U+000A, U+000D, U+0020–U+D7FF, U+E000–U+FFFD, U+10000–U+10FFFF.
 * Bunların dışındaki kontrol karakterleri (U+0000–U+0008, U+000B, U+000C,
 * U+000E–U+001F) ve U+FFFE/U+FFFF tüm belgeyi parse edilemez yapar; silinir.
 */
function stripInvalidXml(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
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

export async function GET() {
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
      where: { status: 'published', deletedAt: null },
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

  const items = articles
    .map(a => {
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
    `    <title>${cdata(settings.title)}</title>\n` +
    `    <link>${SITE_URL}</link>\n` +
    `    <description>${cdata(settings.description)}</description>\n` +
    '    <language>tr</language>\n' +
    `    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>\n` +
    `    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />\n` +
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
