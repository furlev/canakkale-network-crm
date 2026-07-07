import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError, requireLevel } from '@/lib/api';
import { warnCreate } from '@/lib/schemas';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    await requireLevel('B'); // uyarı listesi yalnız lider/yönetici
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const warns = await prisma.warn.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        issuedBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(warns);
  } catch (error) {
    return handleApiError(error, 'Uyarılar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');
    const body = await parseBody(request, warnCreate);
    const created = await prisma.warn.create({
      data: {
        userId: body.userId,
        reason: body.reason,
        severity: body.severity || 'normal',
        issuedById: session?.sub || null,
      },
      include: { issuedBy: { select: { id: true, name: true } } },
    });
    await audit(session, 'created', 'warn', created.id, `Uyarı verildi (${created.severity}): ${body.reason.slice(0, 120)}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Uyarı oluşturulamadı');
  }
}
