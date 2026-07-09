import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel } from '@/lib/api';

/**
 * Yorum moderasyon kuyruğu (W1-D, panel). Yalnızca B/A (requireLevel('B')).
 * GET ?status=pending|approved|rejected|spam|all — liste + durum sayıları.
 * Her yorum, ait olduğu haberin başlık/slug bilgisiyle zenginleştirilir
 * (SiteComment ↔ SiteArticle arası Prisma ilişkisi yok; ayrı sorgu ile eşlenir).
 */

const STATUSES = ['pending', 'approved', 'rejected', 'spam'] as const;

export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const status = new URL(request.url).searchParams.get('status') || 'pending';
    const where = (STATUSES as readonly string[]).includes(status) ? { status } : {};

    const [items, grouped] = await Promise.all([
      prisma.siteComment.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.siteComment.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const articleIds = [...new Set(items.map(c => c.articleId))];
    const articles = articleIds.length
      ? await prisma.siteArticle.findMany({
          where: { id: { in: articleIds } },
          select: { id: true, title: true, slug: true },
        })
      : [];
    const articleMap = new Map(articles.map(a => [a.id, a]));

    const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0, spam: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;

    const enriched = items.map(c => ({
      id: c.id,
      articleId: c.articleId,
      article: articleMap.get(c.articleId) ?? null,
      name: c.name,
      email: c.email,
      body: c.body,
      status: c.status,
      aiScore: c.aiScore,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ items: enriched, counts });
  } catch (error) {
    return handleApiError(error, 'Yorumlar alınamadı');
  }
}
