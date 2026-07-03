import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { newsUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseBody(request, newsUpdate);
    const params = await context.params;
    const updated = await prisma.news.update({
      where: { id: params.id },
      data: {
        title: body.title,
        category: body.category,
        author: body.author,
        status: body.status,
        publishDate: body.status !== undefined
          ? (body.status === 'published' ? new Date() : null)
          : undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Haber güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.news.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Haber silinemedi');
  }
}
