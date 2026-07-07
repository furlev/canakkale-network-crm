import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { paymentUpdate } from '@/lib/schemas';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';

type PaymentData = {
  status?: string;
  paidAt?: Date | null;
  title?: string;
  amount?: number;
  note?: string | null;
  dueDate?: Date | null;
};

/** Üye kendi kaydını 'paid' işaretleyebilir; lider/yönetici her şeyi düzenler. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, 'Oturum gerekli');
    const params = await context.params;
    const body = await parseBody(request, paymentUpdate);

    const existing = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, 'Kayıt bulunamadı');

    const manager = isLeaderOrAdmin(session);
    const owner = existing.userId === session.sub;
    if (!manager && !owner) throw new ApiError(403, 'Bu kayda erişim yetkiniz yok');
    if (!manager && owner && body.status && body.status !== 'paid') {
      throw new ApiError(403, 'Yalnızca "ödedim" olarak işaretleyebilirsiniz');
    }

    const data: PaymentData = {};
    if (body.status) {
      data.status = body.status;
      data.paidAt = body.status === 'paid' ? new Date() : null;
    }
    if (manager) {
      if (body.title !== undefined) data.title = body.title;
      if (body.amount !== undefined) data.amount = body.amount;
      if (body.note !== undefined) data.note = body.note ?? null;
      if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    const updated = await prisma.paymentRequest.update({
      where: { id: params.id },
      data,
      include: { user: { select: { id: true, name: true, email: true } }, budget: { select: { id: true, title: true } } },
    });
    if (body.status) {
      await audit(session, body.status, 'payment', updated.id, `Ödeme "${updated.title}" → ${body.status} (${updated.amount} ₺)`);
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Ödeme güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için yetki gerekli');
    const params = await context.params;
    await prisma.paymentRequest.delete({ where: { id: params.id } });
    await audit(session, 'deleted', 'payment', params.id, 'Ödeme kaydı silindi');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Ödeme silinemedi');
  }
}
