import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { articleUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseBody(request, articleUpdate);
    const params = await context.params;
    const updated = await prisma.article.update({
      where: { id: params.id },
      data: {
        title: body.title,
        content: body.content,
        category: body.category,
        views: body.views,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Makale güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.article.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Makale silinemedi');
  }
}
