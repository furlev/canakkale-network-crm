import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { leadUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, leadUpdate);
    const params = await context.params;
    const existing = await prisma.lead.findUnique({ where: { id: params.id }, select: { deletedAt: true } });
    if (!existing || existing.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');
    const updated = await prisma.lead.update({
      where: { id: params.id },
      data: {
        name: body.name,
        company: body.company,
        value: body.value,
        status: body.status,
        priority: body.priority,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Lead güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    // Yumuşak silme: kayıt çöp kutusuna taşınır, /trash sayfasından geri alınabilir
    const deleted = await prisma.lead.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await audit(session, 'deleted', 'lead', deleted.id, `Lead çöp kutusuna taşındı: ${deleted.name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Lead silinemedi');
  }
}
