import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { hasLevel } from '@/lib/permissions';

const timeEntryUpdate = z.object({
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  minutes: z.coerce.number().int().min(1).max(24 * 60).optional(),
  billable: z.boolean().optional(),
  rate: z.coerce.number().min(0).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  date: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'Geçersiz tarih' }).optional(),
});

function toDateOnly(v: string): Date {
  const d = new Date(v);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Kayıt oturum sahibinindir VEYA çağıran B/A ise düzenlenebilir. */
async function ensureOwnerOrLeader(id: string, session: { sub: string; role: string }) {
  const entry = await prisma.timeEntry.findUnique({ where: { id }, select: { userId: true } });
  if (!entry) throw new ApiError(404, 'Kayıt bulunamadı');
  if (entry.userId !== session.sub && !hasLevel(session, 'B')) {
    throw new ApiError(403, 'Bu kayıt için yetkiniz yok');
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('C');
    const { id } = await context.params;
    await ensureOwnerOrLeader(id, session);
    const body = await parseBody(request, timeEntryUpdate);
    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        projectId: body.projectId !== undefined ? (body.projectId || null) : undefined,
        taskId: body.taskId !== undefined ? (body.taskId || null) : undefined,
        minutes: body.minutes,
        billable: body.billable,
        rate: body.rate !== undefined ? (body.rate ?? null) : undefined,
        note: body.note !== undefined ? (body.note || null) : undefined,
        date: body.date !== undefined ? toDateOnly(body.date) : undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Zaman kaydı güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('C');
    const { id } = await context.params;
    await ensureOwnerOrLeader(id, session);
    await prisma.timeEntry.delete({ where: { id } }); // kalıcı silme (soft-delete alanı yok)
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Zaman kaydı silinemedi');
  }
}
