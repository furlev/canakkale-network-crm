import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { proposalUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, proposalUpdate);
    const params = await context.params;
    const existing = await prisma.proposal.findUnique({ where: { id: params.id }, select: { deletedAt: true } });
    if (!existing || existing.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');
    const updated = await prisma.proposal.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description,
        value: body.value,
        status: body.status,
        clientId: body.clientId !== undefined ? (body.clientId || null) : undefined,
      },
      include: { client: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Teklifname güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    // Yumuşak silme: kayıt çöp kutusuna taşınır, /trash sayfasından geri alınabilir
    const deleted = await prisma.proposal.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await audit(session, 'deleted', 'proposal', deleted.id, `Teklifname çöp kutusuna taşındı: ${deleted.title}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Teklifname silinemedi');
  }
}
