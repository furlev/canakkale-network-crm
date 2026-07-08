import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel } from '@/lib/api';

const STATUSES = ['new', 'reviewed', 'accepted', 'rejected'] as const;

/** GET — başvuru listesi: ?status=new|reviewed|accepted|rejected|all + durum sayıları. */
export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const status = new URL(request.url).searchParams.get('status') || 'all';
    const where = (STATUSES as readonly string[]).includes(status) ? { status } : {};

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [items, grouped, today] = await Promise.all([
      prisma.joinApplication.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.joinApplication.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.joinApplication.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    const counts: Record<string, number> = { new: 0, reviewed: 0, accepted: 0, rejected: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;

    return NextResponse.json({ items, counts: { ...counts, today } });
  } catch (error) {
    return handleApiError(error, 'Başvurular alınamadı');
  }
}
