import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const ferryUpdate = z.object({
  route: z.string().min(1).max(120).optional(),
  departTime: z.string().regex(HHMM, 'Saat HH:MM biçiminde olmalı').optional(),
  days: z.enum(['hergun', 'haftaici', 'haftasonu']).optional(),
  operator: z.string().max(80).optional().nullable(),
  season: z.enum(['yaz', 'kis']).optional().nullable(),
  active: z.boolean().optional(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const body = await parseBody(request, ferryUpdate);

    const existing = await prisma.ferrySchedule.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Sefer bulunamadı');

    const updated = await prisma.ferrySchedule.update({
      where: { id },
      data: {
        ...(body.route !== undefined ? { route: body.route.trim() } : {}),
        ...(body.departTime !== undefined ? { departTime: body.departTime } : {}),
        ...(body.days !== undefined ? { days: body.days } : {}),
        ...(body.operator !== undefined ? { operator: body.operator?.trim() || 'GESTAŞ' } : {}),
        ...(body.season !== undefined ? { season: body.season || null } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });

    await audit(session, 'updated', 'ferrySchedule', id, `Feribot seferi güncellendi: ${updated.route} ${updated.departTime}`);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Feribot seferi güncellenemedi');
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const existing = await prisma.ferrySchedule.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Sefer bulunamadı');

    await prisma.ferrySchedule.delete({ where: { id } });
    await audit(session, 'deleted', 'ferrySchedule', id, `Feribot seferi silindi: ${existing.route} ${existing.departTime}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'Feribot seferi silinemedi');
  }
}
