import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { estimateUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, estimateUpdate);
    const params = await context.params;
    const existing = await prisma.estimate.findUnique({ where: { id: params.id }, select: { deletedAt: true } });
    if (!existing || existing.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');
    const updated = await prisma.estimate.update({
      where: { id: params.id },
      data: {
        amount: body.amount,
        status: body.status,
        clientId: body.clientId !== undefined ? (body.clientId || null) : undefined,
        validUntil: body.validUntil !== undefined ? (body.validUntil ? new Date(body.validUntil) : null) : undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Teklif güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    // Yumuşak silme: kayıt çöp kutusuna taşınır, /trash sayfasından geri alınabilir
    const deleted = await prisma.estimate.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await audit(session, 'deleted', 'estimate', deleted.id, `Teklif çöp kutusuna taşındı: ${deleted.estimateNo}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Teklif silinemedi');
  }
}
