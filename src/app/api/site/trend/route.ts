import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';

/**
 * Trend haberler (halka açık; proxy'de public + IP rate-limitli okuma kovası).
 *
 * Son ~24-48 saatteki ArticleViewDaily.count toplamına göre en çok okunanları döner.
 * ArticleViewDaily gün bazlı (@db.Date) olduğundan "bugün + dün" toplamı alınır —
 * bu, günün erken saatlerinde bile anlamlı bir trend penceresi verir.
 *
 * SiteArticle.views (tüm zamanlar) sayacından bağımsızdır: burada kısa vadeli
 * ivme ölçülür. Gövde/görsel (data-URI olabilir) ASLA seçilmez — satırlar hafif.
 *
 * GRACEFUL: hiç günlük veri yoksa boş liste döner (build/istemci kırılmaz).
 */

export const dynamic = 'force-dynamic';

const TAKE = 8;

export async function GET() {
  try {
    // UTC gün sınırları: dün 00:00'dan itibaren (bugün + dün penceresi).
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const since = new Date(todayUtc);
    since.setUTCDate(since.getUTCDate() - 1);

    // Pencere içi günlük toplamları makale bazında topla, en yükseği başta.
    // Yayından kalkmış/taslak makaleleri elemek için fazladan çekip aşağıda süzeriz.
    const grouped = await prisma.articleViewDaily.groupBy({
      by: ['articleId'],
      where: { date: { gte: since } },
      _sum: { count: true },
      orderBy: { _sum: { count: 'desc' } },
      take: TAKE * 4,
    });

    if (grouped.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const trendById = new Map<string, number>();
    for (const g of grouped) trendById.set(g.articleId, g._sum.count ?? 0);
    const ids = grouped.map(g => g.articleId);

    // Yalnızca yayınlanmış, silinmemiş haberler; hafif alanlar.
    const articles = await prisma.siteArticle.findMany({
      where: { id: { in: ids }, status: 'published', deletedAt: null },
      select: {
        slug: true,
        title: true,
        views: true,
        category: { select: { name: true } },
        id: true,
      },
    });

    // Trend skoruna göre sırala (groupBy sırası korunur), ilk TAKE.
    const items = articles
      .map(a => ({
        slug: a.slug,
        title: a.title,
        views: a.views,
        trendCount: trendById.get(a.id) ?? 0,
        categoryName: a.category?.name ?? null,
      }))
      .sort((x, y) => y.trendCount - x.trendCount)
      .slice(0, TAKE);

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, 'Trend haberler alınamadı');
  }
}
