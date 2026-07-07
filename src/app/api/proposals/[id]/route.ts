import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { proposalUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, proposalUpdate);
    const params = await context.params;
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
    await requireLevel('B');
    const params = await context.params;
    await prisma.proposal.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Teklifname silinemedi');
  }
}
