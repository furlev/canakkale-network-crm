import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { paymentCreate } from '@/lib/schemas';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { notify } from '@/lib/notify';

/** Yönetici/lider tüm ödemeleri; üye yalnızca kendi ödemelerini görür. */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, 'Oturum gerekli');
    const manager = isLeaderOrAdmin(session);
    const payments = await prisma.paymentRequest.findMany({
      where: manager ? undefined : { userId: session.sub },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        budget: { select: { id: true, title: true } },
      },
    });
    return NextResponse.json(payments);
  } catch (error) {
    return handleApiError(error, 'Ödemeler alınamadı');
  }
}

/** Tek bir ödeme/maaş kaydı oluştur (lider/yönetici). */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için yetki gerekli');
    const body = await parseBody(request, paymentCreate);
    const created = await prisma.paymentRequest.create({
      data: {
        kind: body.kind || 'salary',
        userId: body.userId,
        title: body.title,
        amount: body.amount,
        note: body.note || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await notify('info', `Yeni ödeme/maaş kaydı: ${body.title}`, '/payments');
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Ödeme kaydı oluşturulamadı');
  }
}
