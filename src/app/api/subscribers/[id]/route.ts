import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { subscriberUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseBody(request, subscriberUpdate);
    const params = await context.params;
    const updated = await prisma.subscriber.update({
      where: { id: params.id },
      data: {
        email: body.email,
        source: body.source,
        status: body.status,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Abone güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.subscriber.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Abone silinemedi');
  }
}
