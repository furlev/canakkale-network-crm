import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { taskUpdate } from '@/lib/schemas';
import { notify } from '@/lib/notify';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseBody(request, taskUpdate);
    const params = await context.params;
    const before = await prisma.task.findUnique({ where: { id: params.id }, select: { assigneeId: true } });
    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        projectId: body.projectId !== undefined ? (body.projectId || null) : undefined,
        assigneeId: body.assigneeId !== undefined ? (body.assigneeId || null) : undefined,
        dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
      },
    });

    if (updated.assigneeId && updated.assigneeId !== before?.assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: updated.assigneeId }, select: { name: true } });
      await notify('task', `Görev atandı: ${updated.title}${assignee ? ` → ${assignee.name}` : ''}`, '/tasks');
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Görev güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.task.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Görev silinemedi');
  }
}
