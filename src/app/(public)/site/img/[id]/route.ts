import prisma from '@/lib/prisma';

/**
 * GET /img/[id] — SiteArticle görsel proxy'si.
 *
 * SiteArticle.imageUrl ya gerçek bir https URL (WP'den göç eden haberler) ya da
 * AI'ın ürettiği dev base64 data-URI tutar. Data-URI'leri SSR HTML'ine gömmek
 * sayfaları megabaytlarca şişirir; bu endpoint görselleri HTML dışına taşır:
 *   - imageUrl yok           → 302, markalı placeholder (/site/logo-dark.png)
 *   - imageUrl "http…"       → 308, tarayıcı gerçek URL'i doğrudan çeker (byte proxy yok)
 *   - imageUrl "data:…"      → base64 decode edilip ETag + cache header'larıyla servis edilir
 *
 * Proxy, canakkale.network/img/[id] isteğini /site/img/[id]'ye rewrite eder.
 */

const CACHE = 'public, max-age=3600, stale-while-revalidate=86400';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  let article: { imageUrl: string | null; updatedAt: Date } | null = null;
  try {
    article = await prisma.siteArticle.findUnique({
      where: { id },
      select: { imageUrl: true, updatedAt: true },
    });
  } catch {
    // DB erişilemez → placeholder'a düş
  }

  if (!article) {
    return new Response('Bulunamadı', { status: 404 });
  }

  const { imageUrl, updatedAt } = article;

  // Görsel yok → markalı placeholder (302; tarayıcı yeniden sorgulayabilir)
  if (!imageUrl || imageUrl.trim() === '') {
    return new Response(null, {
      status: 302,
      headers: { Location: '/site/logo-dark.png' },
    });
  }

  // Gerçek görsel → tarayıcı doğrudan kaynağından çeksin (byte proxy'lemeyiz)
  if (/^https?:\/\//i.test(imageUrl)) {
    return new Response(null, {
      status: 308,
      headers: { Location: imageUrl, 'Cache-Control': CACHE },
    });
  }

  // data:<mime>;base64,<veri> → decode edip servis et
  if (imageUrl.startsWith('data:')) {
    const comma = imageUrl.indexOf(',');
    if (comma === -1) {
      return new Response('Geçersiz görsel', { status: 404 });
    }
    const meta = imageUrl.slice(5, comma); // "data:" sonrası: image/png;base64
    const data = imageUrl.slice(comma + 1);
    const mime = meta.split(';')[0] || 'image/jpeg';
    const isBase64 = /;base64/i.test(meta);
    const buffer = isBase64
      ? Buffer.from(data, 'base64')
      : Buffer.from(decodeURIComponent(data), 'utf8');

    const etag = `"${id}-${updatedAt.getTime()}"`;
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': CACHE },
      });
    }

    return new Response(buffer, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': CACHE,
        ETag: etag,
      },
    });
  }

  // Tanınmayan biçim → placeholder
  return new Response(null, {
    status: 302,
    headers: { Location: '/site/logo-dark.png' },
  });
}
