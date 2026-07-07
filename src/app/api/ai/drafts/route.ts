import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';

const STATUSES = ['pending', 'approved', 'rejected', 'published'] as const;

/** AI haber taslaklarını listeler. ?status ile filtre (varsayılan: pending, all = tümü). */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const status = new URL(request.url).searchParams.get('status') || 'pending';
    const where = status === 'all' ? undefined
      : (STATUSES as readonly string[]).includes(status) ? { status }
      : { status: 'pending' };

    // imageUrl base64 data-URI olabilir (satır başına MB'lar) → listede TAŞIMA.
    // Hafif alanları seç; görsel varlığını ayrı ucuz bir sorguyla hasImage bayrağına çevir.
    const [items, withImage] = await Promise.all([
      prisma.aiDraft.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, topic: true, title: true, body: true, category: true, tags: true,
          seoTitle: true, metaDescription: true, socialPost: true, sources: true,
          confidence: true, status: true, reviewerId: true, reviewerName: true,
          wpId: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.aiDraft.findMany({
        where: { ...(where || {}), imageUrl: { not: null } },
        select: { id: true },
      }),
    ]);
    const imageIds = new Set(withImage.map((r) => r.id));
    return NextResponse.json(items.map((i) => ({ ...i, hasImage: imageIds.has(i.id) })));
  } catch (error) {
    return handleApiError(error, 'Taslaklar alınamadı');
  }
}
