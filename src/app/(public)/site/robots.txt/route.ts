/**
 * robots.txt — tüm botlara açık; sitemap adresini bildirir.
 * Proxy, canakkale.network/robots.txt isteğini buraya rewrite eder.
 */
export function GET() {
  const body = ['User-agent: *', 'Allow: /', '', 'Sitemap: https://canakkale.network/sitemap.xml', ''].join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
    },
  });
}
