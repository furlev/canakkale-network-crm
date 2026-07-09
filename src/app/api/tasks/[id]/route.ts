import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { taskUpdate } from '@/lib/schemas';
import { notify } from '@/lib/notify';

// recurrence şeması schemas.ts'e eklenmedi (dosya paylaşımlı); yerel extend ile doğrulanır
const taskUpdateWithRecurrence = taskUpdate.extend({
  recurrence: z.enum(['daily', 'weekly', 'monthly']).or(z.literal('')).nullable().optional(),
  dependsOnId: z.string().nullable().optional(), // görev bağımlılığı (P2 W3-B)
});

/** Tekrarlayan görev tamamlanınca sonraki örneğin son teslim tarihi */
function nextDueDate(base: Date, recurrence: string): Date {
  const next = new Date(base);
  if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  else if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1); // monthly
  return next;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('C');
    const body = await parseBody(request, taskUpdateWithRecurrence);
    const params = await context.params;
    const before = await prisma.task.findUnique({
      where: { id: params.id },
      select: { assigneeId: true, status: true, deletedAt: true },
    });
    if (!before || before.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');
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
        recurrence: body.recurrence !== undefined ? (body.recurrence || null) : undefined,
        dependsOnId: body.dependsOnId !== undefined ? (body.dependsOnId || null) : undefined,
      },
    });

    // Tekrarlayan görev: 'done' durumuna İLK geçişte sonraki örneği üret
    // (before.status !== 'done' koşulu çifte üretimi engeller)
    if (updated.status === 'done' && before.status !== 'done' && updated.recurrence) {
      await prisma.task.create({
        data: {
          title: updated.title,
          description: updated.description,
          status: 'todo',
          priority: updated.priority,
          projectId: updated.projectId,
          assigneeId: updated.assigneeId,
          recurrence: updated.recurrence,
          dueDate: nextDueDate(updated.dueDate ?? new Date(), updated.recurrence),
        },
      });
    }

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
    const session = await requireLevel('C');
    const params = await context.params;
    // Yumuşak silme: kayıt çöp kutusuna taşınır, /trash sayfasından geri alınabilir
    const deleted = await prisma.task.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await audit(session, 'deleted', 'task', deleted.id, `Görev çöp kutusuna taşındı: ${deleted.title}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Görev silinemedi');
  }
}
