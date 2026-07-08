import prisma from '@/lib/prisma';

/**
 * sitemap.xml — yayınlanmış haberler + kategoriler + statik sayfalar + kök.
 * Proxy, canakkale.network/sitemap.xml isteğini buraya rewrite eder.
 */

const SITE_URL = 'https://canakkale.network';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function url(loc: string, lastmod?: Date | null, changefreq?: string, priority?: string): string {
  return (
    '  <url>\n' +
    `    <loc>${esc(loc)}</loc>\n` +
    (lastmod ? `    <lastmod>${lastmod.toISOString()}</lastmod>\n` : '') +
    (changefreq ? `    <changefreq>${changefreq}</changefreq>\n` : '') +
    (priority ? `    <priority>${priority}</priority>\n` : '') +
    '  </url>\n'
  );
}

export async function GET() {
  let articles: { slug: string; updatedAt: Date }[] = [];
  let categories: { slug: string }[] = [];
  let pages: { slug: string; updatedAt: Date }[] = [];

  try {
    [articles, categories, pages] = await Promise.all([
      prisma.siteArticle.findMany({
        where: { status: 'published', deletedAt: null },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 5000,
      }),
      prisma.siteCategory.findMany({ select: { slug: true }, orderBy: { order: 'asc' } }),
      prisma.sitePage.findMany({
        where: { status: 'published' },
        select: { slug: true, updatedAt: true },
      }),
    ]);
  } catch {
    // DB erişilemezse en azından kök URL'leri döndür
  }

  let body = '<?xml version="1.0" encoding="UTF-8"?>\n';
  body += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  body += url(`${SITE_URL}/`, null, 'hourly', '1.0');
  body += url(`${SITE_URL}/haberler`, null, 'hourly', '0.9');
  body += url(`${SITE_URL}/ekibimize-katil`, null, 'monthly', '0.5');
  body += url(`${SITE_URL}/iletisim`, null, 'monthly', '0.5');

  for (const c of categories) {
    body += url(`${SITE_URL}/kategori/${c.slug}`, null, 'daily', '0.7');
  }
  for (const p of pages) {
    body += url(`${SITE_URL}/${p.slug}`, p.updatedAt, 'monthly', '0.4');
  }
  for (const a of articles) {
    body += url(`${SITE_URL}/haber/${a.slug}`, a.updatedAt, 'weekly', '0.8');
  }
  body += '</urlset>\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
