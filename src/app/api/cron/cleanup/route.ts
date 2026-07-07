import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { safeEqual } from '@/lib/secure';

export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Periyodik temizlik (günlük cron):
 *  a) 30 günden eski FeedItem kayıtlarını siler (dedup penceresi çoktan kapanmıştır),
 *  b) 30 günden eski yayınlanmış/reddedilmiş taslakların base64 görselini boşaltır
 *     (yayınlananların görseli zaten WP medya kütüphanesinde),
 *  c) 90 günden eski reddedilmiş taslakları tamamen siler.
 * Erişim: Bearer CRON_SECRET veya admin oturumu (seed-sources ile aynı desen).
 */
export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    const cronOk = !!process.env.CRON_SECRET && safeEqual(auth, `Bearer ${process.env.CRON_SECRET}`);
    if (!cronOk && !isAdmin(await getSession())) throw new ApiError(403, 'Yetkisiz');

    const now = Date.now();
    const cutoff30 = new Date(now - 30 * DAY_MS);
    const cutoff90 = new Date(now - 90 * DAY_MS);

    // c önce: 90 günden eski reddedilmişler silinsin ki (b) updatedAt'lerini boşuna tazelemesin
    const rejectedDrafts = await prisma.aiDraft.deleteMany({
      where: { status: 'rejected', updatedAt: { lt: cutoff90 } },
    });

    // a) eski feed öğeleri
    const feedItems = await prisma.feedItem.deleteMany({
      where: { fetchedAt: { lt: cutoff30 } },
    });

    // b) eski yayınlanmış/reddedilmiş taslakların büyük base64 görsellerini boşalt
    const images = await prisma.aiDraft.updateMany({
      where: {
        status: { in: ['published', 'rejected'] },
        updatedAt: { lt: cutoff30 },
        imageUrl: { not: null },
      },
      data: { imageUrl: null },
    });

    return NextResponse.json({
      ok: true,
      feedItemsDeleted: feedItems.count,
      imagesCleared: images.count,
      rejectedDraftsDeleted: rejectedDrafts.count,
    });
  } catch (error) {
    return handleApiError(error, 'Temizlik görevi başarısız');
  }
}
