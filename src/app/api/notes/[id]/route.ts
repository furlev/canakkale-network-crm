import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { noteUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('C');
    const body = await parseBody(request, noteUpdate);
    const params = await context.params;
    const updated = await prisma.note.update({
      where: { id: params.id },
      data: {
        title: body.title,
        content: body.content,
        category: body.category,
        color: body.color,
        shared: body.shared,
        favorite: body.favorite,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Not güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('C');
    const params = await context.params;
    await prisma.note.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Not silinemedi');
  }
}
