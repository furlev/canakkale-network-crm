import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { eventUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel(); // C: takvim tüm kullanıcılara açık
    const body = await parseBody(request, eventUpdate);
    const params = await context.params;
    const updated = await prisma.event.update({
      where: { id: params.id },
      data: {
        title: body.title,
        date: body.date ? new Date(body.date) : undefined,
        type: body.type,
        description: body.description,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Etkinlik güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel(); // C: takvim tüm kullanıcılara açık
    const params = await context.params;
    await prisma.event.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Etkinlik silinemedi');
  }
}
