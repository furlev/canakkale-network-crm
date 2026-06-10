import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { taskCreate } from '@/lib/schemas';
import { notify } from '@/lib/notify';

const safeAssignee = { select: { id: true, name: true, email: true, role: true, department: true, status: true, avatar: true } };

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        include: { project: true, assignee: safeAssignee },
        ...(pagination ?? {}),
      }),
      pagination ? prisma.task.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Görevler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, taskCreate);
    const created = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description || null,
        status: body.status || 'todo',
        priority: body.priority || 'normal',
        projectId: body.projectId || null,
        assigneeId: body.assigneeId || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });

    if (created.assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: created.assigneeId }, select: { name: true } });
      await notify('task', `Görev atandı: ${created.title}${assignee ? ` → ${assignee.name}` : ''}`, '/tasks');
    }
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Görev oluşturulamadı');
  }
}
