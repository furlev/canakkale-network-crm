import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { invoiceUpdate } from '@/lib/schemas';
import { notify } from '@/lib/notify';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, invoiceUpdate);
    const params = await context.params;
    const before = await prisma.invoice.findUnique({ where: { id: params.id }, select: { status: true, deletedAt: true } });
    if (!before || before.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');
    const updated = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        amount: body.amount,
        status: body.status,
        clientId: body.clientId !== undefined ? (body.clientId || null) : undefined,
        dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
      },
    });

    if (before?.status !== 'paid' && updated.status === 'paid') {
      await notify('invoice_paid', `Fatura ${updated.invoiceNo} ödendi — ₺${updated.amount.toLocaleString('tr-TR')}`, '/invoices');
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Fatura güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    // Yumuşak silme: kayıt çöp kutusuna taşınır, /trash sayfasından geri alınabilir
    const deleted = await prisma.invoice.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await audit(session, 'deleted', 'invoice', deleted.id, `Fatura çöp kutusuna taşındı: ${deleted.invoiceNo}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Fatura silinemedi');
  }
}
