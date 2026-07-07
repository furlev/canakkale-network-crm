import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { clientUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, clientUpdate);
    const params = await context.params;
    const existing = await prisma.client.findUnique({ where: { id: params.id }, select: { deletedAt: true } });
    if (!existing || existing.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');
    const updated = await prisma.client.update({
      where: { id: params.id },
      data: {
        companyName: body.companyName,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        status: body.status,
        satisfaction: body.satisfaction,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Müşteri güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    // Yumuşak silme: kayıt çöp kutusuna taşınır, /trash sayfasından geri alınabilir
    const deleted = await prisma.client.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await audit(session, 'deleted', 'client', deleted.id, `Müşteri çöp kutusuna taşındı: ${deleted.companyName}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Müşteri silinemedi');
  }
}
