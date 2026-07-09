import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';
import { DISTRICT_SLUGS } from '@/lib/districts';

/**
 * Halka açık haber listesi ucu. Proxy'de `/api/site/` altında olduğu için oturum
 * gerekmez ve IP bazlı okuma hız sınırına tabidir (bkz. src/proxy.ts).
 *
 * GET /api/site/articles?ilce=<slug>&take=<n>
 *  - ilce: DISTRICTS'ten geçerli bir ilçe slug'ı (zorunlu). Geçersizse boş liste.
 *  - take: 1–12 arası (varsayılan 8).
 *
 * "İlçenden Haberler" rayı (DistrictNewsRail) bunu kullanır. Gövde (body) ve görsel
 * (imageUrl, data-URI olabilir) ASLA seçilmez — satırlar hafif kalır, görsel /img/[id]'den gelir.
 */
export const dynamic = 'force-dynamic';

const DEFAULT_TAKE = 8;
const MAX_TAKE = 12;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ilce = (url.searchParams.get('ilce') || '').toLowerCase();

    // Geçersiz/eksik ilçe → boş liste (istemci zaten gizli kalır)
    if (!DISTRICT_SLUGS.includes(ilce)) {
      return NextResponse.json({ items: [] });
    }

    const takeRaw = parseInt(url.searchParams.get('take') || '', 10);
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), MAX_TAKE) : DEFAULT_TAKE;

    const rows = await prisma.siteArticle.findMany({
      where: { status: 'published', deletedAt: null, district: ilce },
      // publishedAt=null satırlar tepeye yapışmasın
      orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
      take,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        imageAlt: true,
        imageIsAi: true,
        categorySlug: true,
        isBreaking: true,
        publishedAt: true,
        views: true,
        authorName: true,
        category: { select: { name: true } },
      },
    });

    const items = rows.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      imageAlt: a.imageAlt,
      imageIsAi: a.imageIsAi,
      categorySlug: a.categorySlug,
      categoryName: a.category?.name ?? null,
      isBreaking: a.isBreaking,
      publishedAt: a.publishedAt,
      views: a.views,
      authorName: a.authorName,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, 'Haberler alınamadı');
  }
}
