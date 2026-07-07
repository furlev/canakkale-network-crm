import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { projectUpdate } from '@/lib/schemas';
import { notify } from '@/lib/notify';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, projectUpdate);
    const params = await context.params;
    const before = await prisma.project.findUnique({ where: { id: params.id }, select: { status: true } });
    const updated = await prisma.project.update({
      where: { id: params.id },
      data: {
        name: body.name,
        status: body.status,
        progress: body.progress,
        clientId: body.clientId !== undefined ? (body.clientId || null) : undefined,
        deadline: body.deadline !== undefined ? (body.deadline ? new Date(body.deadline) : null) : undefined,
      },
    });

    if (before?.status !== 'completed' && updated.status === 'completed') {
      await notify('project_completed', `Proje tamamlandı: ${updated.name}`, '/projects');
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Proje güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const params = await context.params;
    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Proje silinemedi');
  }
}
