import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { announcementUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, announcementUpdate);
    const params = await context.params;
    const updated = await prisma.announcement.update({
      where: { id: params.id },
      data: {
        title: body.title,
        content: body.content,
        target: body.target,
        priority: body.priority,
        author: body.author,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Duyuru güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const params = await context.params;
    await prisma.announcement.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Duyuru silinemedi');
  }
}
