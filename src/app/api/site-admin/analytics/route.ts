import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel } from '@/lib/api';
import { districtName } from '@/lib/districts';

/**
 * Site analitik özeti (requireLevel('B')). ArticleEvent tablosundan:
 *  - toplamlar (görüntülenme / okuma tamamlama / paylaşım / dış tıklama)
 *  - en çok okunan haberler
 *  - trafik kaynağı kırılımı (referrerHost — sadece 'view' olayları)
 *  - günlük görüntülenme serisi
 *  - ilçe ve kategori kırılımı
 *
 * `?days=` ile pencere (varsayılan 30, 1..365'e sıkıştırılır).
 * Ağır satırlar taşınmaz; her şey DB tarafında toplanır (groupBy + $queryRaw).
 */
export async function GET(request: Request) {
  try {
    await requireLevel('B');

    const url = new URL(request.url);
    const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days') || '30', 10) || 30));
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      byType,
      trafficRows,
      districtRows,
      dailyRows,
      topRows,
      categoryRows,
    ] = await Promise.all([
      // Tür bazında toplamlar
      prisma.articleEvent.groupBy({
        by: ['type'],
        where: { createdAt: { gte: from } },
        _count: { _all: true },
      }),
      // Trafik kaynağı — yalnız görüntülenmeler, host bilinenler
      prisma.articleEvent.groupBy({
        by: ['referrerHost'],
        where: { createdAt: { gte: from }, type: 'view', referrerHost: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { referrerHost: 'desc' } },
        take: 12,
      }),
      // İlçe kırılımı — görüntülenmeler
      prisma.articleEvent.groupBy({
        by: ['district'],
        where: { createdAt: { gte: from }, type: 'view', district: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { district: 'desc' } },
      }),
      // Günlük görüntülenme serisi
      prisma.$queryRaw<{ date: string; views: number }[]>`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS date,
               count(*)::int AS views
        FROM "ArticleEvent"
        WHERE type = 'view' AND "createdAt" >= ${from}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      // En çok okunan haberler (dönem içi görüntülenme)
      prisma.$queryRaw<{ slug: string; title: string; views: number }[]>`
        SELECT e.slug AS slug, a.title AS title, count(*)::int AS views
        FROM "ArticleEvent" e
        JOIN "SiteArticle" a ON a.id = e."articleId"
        WHERE e.type = 'view' AND e."createdAt" >= ${from}
        GROUP BY e.slug, a.title
        ORDER BY views DESC
        LIMIT 10
      `,
      // Kategori kırılımı (haber tablosuna join)
      prisma.$queryRaw<{ category: string; views: number }[]>`
        SELECT COALESCE(a."categorySlug", 'diger') AS category, count(*)::int AS views
        FROM "ArticleEvent" e
        JOIN "SiteArticle" a ON a.id = e."articleId"
        WHERE e.type = 'view' AND e."createdAt" >= ${from}
        GROUP BY 1
        ORDER BY views DESC
      `,
    ]);

    const countByType: Record<string, number> = {};
    for (const g of byType) countByType[g.type] = g._count._all;

    return NextResponse.json({
      range: { days, from: from.toISOString(), to: new Date().toISOString() },
      totals: {
        views: countByType['view'] || 0,
        reads: countByType['read_complete'] || 0,
        shares: countByType['share'] || 0,
        outboundClicks: countByType['outbound_click'] || 0,
      },
      topArticles: topRows.map(r => ({ slug: r.slug, title: r.title, views: r.views })),
      trafficSources: trafficRows.map(r => ({ host: r.referrerHost, count: r._count._all })),
      daily: dailyRows.map(r => ({ date: r.date, views: r.views })),
      districts: districtRows.map(r => ({
        slug: r.district,
        name: districtName(r.district) || r.district,
        views: r._count._all,
      })),
      categories: categoryRows.map(r => ({ category: r.category, views: r.views })),
    });
  } catch (error) {
    return handleApiError(error, 'Analitik alınamadı');
  }
}
