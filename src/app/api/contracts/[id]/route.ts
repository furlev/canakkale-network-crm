import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { contractUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, contractUpdate);
    const params = await context.params;
    const existing = await prisma.contract.findUnique({ where: { id: params.id }, select: { deletedAt: true } });
    if (!existing || existing.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');
    const updated = await prisma.contract.update({
      where: { id: params.id },
      data: {
        title: body.title,
        value: body.value,
        status: body.status,
        progress: body.progress,
        startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
        endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
        clientId: body.clientId !== undefined ? (body.clientId || null) : undefined,
      },
      include: { client: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Sözleşme güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    // Yumuşak silme: kayıt çöp kutusuna taşınır, /trash sayfasından geri alınabilir
    const deleted = await prisma.contract.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await audit(session, 'deleted', 'contract', deleted.id, `Sözleşme çöp kutusuna taşındı: ${deleted.title}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Sözleşme silinemedi');
  }
}
