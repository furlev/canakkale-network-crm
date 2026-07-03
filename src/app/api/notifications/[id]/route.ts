import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';

/** Tek bir bildirimi okundu (ya da body ile okunmadı) işaretle. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    let read = true;
    try {
      const body = await request.json();
      if (typeof body?.read === 'boolean') read = body.read;
    } catch { /* gövde yoksa varsayılan: okundu */ }
    const updated = await prisma.notification.update({ where: { id: params.id }, data: { read } });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Bildirim güncellenemedi');
  }
}
