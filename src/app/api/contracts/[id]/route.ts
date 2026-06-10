import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { contractUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseBody(request, contractUpdate);
    const params = await context.params;
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
    const params = await context.params;
    await prisma.contract.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Sözleşme silinemedi');
  }
}
