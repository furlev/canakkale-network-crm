import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';

/**
 * Halka açık son dakika akışı. Proxy'de `/api/site/` altında olduğu için oturum
 * gerekmez ve IP bazlı okuma hız sınırına tabidir (bkz. src/proxy.ts).
 *
 * GET /api/site/breaking?since=<ISO>
 *  - since verilmezse: en güncel son dakika haberleri (ilk yükleme).
 *  - since verilirse : yalnız publishedAt > since olanlar → BreakingTicker canlı polling.
 *
 * Yanıt: { now, items:[{ id, slug, title, categorySlug, categoryName, color, publishedAt }] }
 * `now` sunucu saatidir; istemci bir sonraki `since` olarak bunu kullanır (saat kayması güvenli).
 * Gövde (body) ve görsel (imageUrl, data-URI olabilir) ASLA seçilmez — satırlar hafif kalır.
 */
export const dynamic = 'force-dynamic';

const MAX_ITEMS = 12;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sinceRaw = url.searchParams.get('since');
    let since: Date | null = null;
    if (sinceRaw) {
      const d = new Date(sinceRaw);
      if (!Number.isNaN(d.getTime())) since = d;
    }

    const rows = await prisma.siteArticle.findMany({
      where: {
        status: 'published',
        deletedAt: null,
        isBreaking: true,
        publishedAt: since ? { gt: since } : { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      take: MAX_ITEMS,
      select: {
        id: true,
        slug: true,
        title: true,
        categorySlug: true,
        publishedAt: true,
        category: { select: { name: true, color: true } },
      },
    });

    const items = rows.map(r => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      categorySlug: r.categorySlug,
      categoryName: r.category?.name ?? null,
      color: r.category?.color ?? null,
      publishedAt: r.publishedAt,
    }));

    return NextResponse.json({ now: new Date().toISOString(), items });
  } catch (error) {
    return handleApiError(error, 'Son dakika akışı alınamadı');
  }
}
