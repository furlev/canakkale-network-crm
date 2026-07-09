import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { taskCreate } from '@/lib/schemas';
import { notify } from '@/lib/notify';

const safeAssignee = { select: { id: true, name: true, email: true, role: true, department: true, status: true, avatar: true } };

// recurrence şeması schemas.ts'e eklenmedi (dosya paylaşımlı); yerel extend ile doğrulanır
const taskCreateWithRecurrence = taskCreate.extend({
  recurrence: z.enum(['daily', 'weekly', 'monthly']).or(z.literal('')).nullable().optional(),
  dependsOnId: z.string().nullable().optional(), // görev bağımlılığı (P2 W3-B)
});

export async function GET(request: Request) {
  try {
    await requireLevel('C');
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { project: true, assignee: safeAssignee },
        ...(pagination ?? {}),
      }),
      pagination ? prisma.task.count({ where: { deletedAt: null } }) : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Görevler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('C');
    const body = await parseBody(request, taskCreateWithRecurrence);
    const created = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description || null,
        status: body.status || 'todo',
        priority: body.priority || 'normal',
        projectId: body.projectId || null,
        assigneeId: body.assigneeId || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        recurrence: body.recurrence || null,
        dependsOnId: body.dependsOnId || null,
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
