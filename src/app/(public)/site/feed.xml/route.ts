import prisma from '@/lib/prisma';
import { getSiteSettings, stripHtml } from '@/lib/site';

/**
 * feed.xml — RSS 2.0: son 30 yayınlanmış haber.
 * Proxy, canakkale.network/feed.xml isteğini buraya rewrite eder.
 */

const SITE_URL = 'https://canakkale.network';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cdata(s: string): string {
  // CDATA içinde "]]>" dizisi kaçışlanır
  return `<![CDATA[${s.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
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
      orderBy: { publishedAt: 'desc' },
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
