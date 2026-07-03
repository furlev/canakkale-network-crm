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

    const items = await prisma.aiDraft.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return handleApiError(error, 'Taslaklar alınamadı');
  }
}
