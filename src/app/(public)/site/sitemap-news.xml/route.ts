import prisma from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site';

/**
 * sitemap-news.xml — Google News sitemap: SON 48 SAATTE yayınlanmış haberler.
 * Google News yalnızca son 2 günün içeriğini bu formatta bekler.
 *
 * NOT (proxy + robots): canakkale.network kök alan adından erişilebilmesi için
 * proxy'de SITE_FILE_ROUTES'a '/sitemap-news.xml' eklenmeli ve robots.txt'e
 * `Sitemap: https://canakkale.network/sitemap-news.xml` satırı eklenmelidir
 * (bkz. rapor). Panel host'unda /site/sitemap-news.xml olarak zaten çalışır.
 */

const SITE_URL = 'https://canakkale.network';

/**
 * XML 1.0'da geçerli olmayan kontrol/özel karakterleri süzer (sitemap.xml ile
 * aynı amaç). Geçerli: U+0009, U+000A, U+000D, U+0020–U+D7FF, U+E000–U+FFFD.
 * Kaynakta ham kontrol karakteri bulundurmamak için kod-noktası testi kullanılır.
 */
function stripInvalidXml(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (
      c === 0x9 ||
      c === 0xa ||
      c === 0xd ||
      (c >= 0x20 && c <= 0xd7ff) ||
      (c >= 0xe000 && c <= 0xfffd)
    ) {
      out += s[i];
    }
  }
  return out;
}

function esc(s: string): string {
  return stripInvalidXml(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const settings = await getSiteSettings();
  const publicationName = settings.title || 'Çanakkale Network';

  let articles: { slug: string; title: string; publishedAt: Date | null }[] = [];
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    articles = await prisma.siteArticle.findMany({
      where: {
        status: 'published',
        deletedAt: null,
        publishedAt: { gte: since },
      },
      orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
      take: 1000,
      select: { slug: true, title: true, publishedAt: true },
    });
  } catch {
    // DB erişilemezse boş (ama geçerli) sitemap döndür
  }

  let body = '<?xml version="1.0" encoding="UTF-8"?>\n';
  body +=
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

  for (const a of articles) {
    if (!a.publishedAt) continue;
    body +=
      '  <url>\n' +
      `    <loc>${esc(`${SITE_URL}/haber/${a.slug}`)}</loc>\n` +
      '    <news:news>\n' +
      '      <news:publication>\n' +
      `        <news:name>${esc(publicationName)}</news:name>\n` +
      '        <news:language>tr</news:language>\n' +
      '      </news:publication>\n' +
      `      <news:publication_date>${a.publishedAt.toISOString()}</news:publication_date>\n` +
      `      <news:title>${esc(a.title)}</news:title>\n` +
      '    </news:news>\n' +
      '  </url>\n';
  }
  body += '</urlset>\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Haber sitemap'i taze olmalı; kısa cache
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=120',
    },
  });
}
