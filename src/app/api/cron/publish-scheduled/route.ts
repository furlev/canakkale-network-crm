import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';
import { safeEqual } from '@/lib/secure';
import { publishDraftToSite } from '@/lib/publish-draft';
import { audit } from '@/lib/audit';

/**
 * Planlı yayın: scheduledAt'i gelmiş ama henüz yayınlanmamış (articleId null) taslakları
 * siteye yayınlar. GitHub Actions cron'u Bearer CRON_SECRET ile çağırır.
 * Reddedilmiş/zaten yayınlanmış atlanır. Her taslak izole (biri patlarsa diğerleri sürer).
 */
export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || !safeEqual(auth, `Bearer ${process.env.CRON_SECRET}`)) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
    }

    const due = await prisma.aiDraft.findMany({
      where: {
        scheduledAt: { not: null, lte: new Date() },
        articleId: null,
        status: { notIn: ['rejected', 'published'] },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });

    const published: string[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const draft of due) {
      try {
        const { article } = await publishDraftToSite(draft, { sub: draft.reviewerId, name: draft.reviewerName });
        published.push(article.slug);
        await audit(null, 'published', 'aiDraft', draft.id, `Planlı AI yayını (${article.slug}): ${article.title}`);
      } catch (e) {
        failed.push({ id: draft.id, reason: e instanceof Error ? e.message : 'hata' });
      }
    }

    // ─── Planlı SiteArticle'lar (#31): status='scheduled' & scheduledAt<=now ───
    // Elle oluşturulmuş zamanlı haberleri yayınlar (AiDraft akışından bağımsız).
    const dueArticles = await prisma.siteArticle.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { not: null, lte: new Date() },
        deletedAt: null,
      },
      orderBy: { scheduledAt: 'asc' },
      select: { id: true, slug: true, title: true },
      take: 50,
    });

    const publishedArticles: string[] = [];
    const failedArticles: { id: string; reason: string }[] = [];
    for (const art of dueArticles) {
      try {
        // Atomik claim: yalnız hâlâ 'scheduled' olanı yayınla (çift-yayın/yarış engeli).
        const claim = await prisma.siteArticle.updateMany({
          where: { id: art.id, status: 'scheduled' },
          data: { status: 'published', publishedAt: new Date() },
        });
        if (claim.count === 0) continue; // başka bir çalıştırma yayınlamış
        publishedArticles.push(art.slug);
        await audit(null, 'published', 'siteArticle', art.id, `Planlı haber yayını (${art.slug}): ${art.title}`);
      } catch (e) {
        failedArticles.push({ id: art.id, reason: e instanceof Error ? e.message : 'hata' });
      }
    }

    return NextResponse.json({
      ok: true,
      due: due.length,
      published,
      failed,
      articlesDue: dueArticles.length,
      articlesPublished: publishedArticles,
      articlesFailed: failedArticles,
    });
  } catch (error) {
    return handleApiError(error, 'Planlı yayın başarısız');
  }
}
