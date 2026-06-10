import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { documentUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseBody(request, documentUpdate);
    const params = await context.params;
    const updated = await prisma.document.update({
      where: { id: params.id },
      data: {
        name: body.name,
        type: body.type,
        size: body.size,
        url: body.url,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Doküman güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.document.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Doküman silinemedi');
  }
}
