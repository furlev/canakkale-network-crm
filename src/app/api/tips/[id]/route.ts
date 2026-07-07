import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { tipUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, tipUpdate);
    const params = await context.params;
    const updated = await prisma.tip.update({
      where: { id: params.id },
      data: {
        subject: body.subject,
        content: body.content,
        source: body.source,
        sourceType: body.sourceType,
        status: body.status,
        priority: body.priority,
        reporterId: body.reporterId !== undefined ? (body.reporterId || null) : undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'İhbar güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const params = await context.params;
    await prisma.tip.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'İhbar silinemedi');
  }
}
