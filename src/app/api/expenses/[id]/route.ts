import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { expenseUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, expenseUpdate);
    const params = await context.params;
    const existing = await prisma.expense.findUnique({ where: { id: params.id }, select: { deletedAt: true } });
    if (!existing || existing.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');
    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: {
        category: body.category,
        amount: body.amount,
        description: body.description,
        date: body.date ? new Date(body.date) : undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Gider güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    // Yumuşak silme: kayıt çöp kutusuna taşınır, /trash sayfasından geri alınabilir
    const deleted = await prisma.expense.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await audit(session, 'deleted', 'expense', deleted.id, `Gider çöp kutusuna taşındı: ${deleted.category} — ₺${deleted.amount.toLocaleString('tr-TR')}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Gider silinemedi');
  }
}
