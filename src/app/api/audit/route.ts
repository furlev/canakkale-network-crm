import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel } from '@/lib/api';

/**
 * Denetim kayıtları — YALNIZ A (Baş Yönetici).
 * ?page=&limit= (varsayılan 50) + ?entity=&userId= filtreleri.
 * Yanıt: { items, total, page, limit, entities } — entities filtre dropdown'ı içindir.
 */
export async function GET(request: Request) {
  try {
    await requireLevel('A');
    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1);
    const entity = url.searchParams.get('entity') || undefined;
    const userId = url.searchParams.get('userId') || undefined;

    const where = {
      ...(entity ? { entity } : {}),
      ...(userId ? { userId } : {}),
    };

    const [items, total, entities] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      entities: entities.map(e => e.entity),
    });
  } catch (error) {
    return handleApiError(error, 'Denetim kayıtları alınamadı');
  }
}
