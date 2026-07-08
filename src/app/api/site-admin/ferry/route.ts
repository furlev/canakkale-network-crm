import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Feribot/vapur tarifesi yönetimi (GESTAŞ resmi API yok → admin-yönetimli).
 * requireLevel('B') — Ekip Lideri/Muhasebe ve üstü. Public feribot sayfası
 * doğrudan prisma'dan okur; bu uçlar yalnızca panel CRUD içindir.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const ferryCreate = z.object({
  route: z.string().min(1).max(120),
  departTime: z.string().regex(HHMM, 'Saat HH:MM biçiminde olmalı'),
  days: z.enum(['hergun', 'haftaici', 'haftasonu']).optional(),
  operator: z.string().max(80).optional().nullable(),
  season: z.enum(['yaz', 'kis']).optional().nullable(),
  active: z.boolean().optional(),
});

/** GET — tüm tarife satırları (rota + kalkış saatine göre sıralı). */
export async function GET() {
  try {
    await requireLevel('B');
    const items = await prisma.ferrySchedule.findMany({
      orderBy: [{ route: 'asc' }, { departTime: 'asc' }],
    });
    return NextResponse.json(items);
  } catch (error) {
    return handleApiError(error, 'Feribot tarifesi alınamadı');
  }
}

/** POST — yeni sefer satırı. */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, ferryCreate);

    const created = await prisma.ferrySchedule.create({
      data: {
        route: body.route.trim(),
        departTime: body.departTime,
        days: body.days || 'hergun',
        operator: body.operator?.trim() || 'GESTAŞ',
        season: body.season || null,
        active: body.active ?? true,
      },
    });

    await audit(session, 'created', 'ferrySchedule', created.id, `Feribot seferi eklendi: ${created.route} ${created.departTime}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Feribot seferi eklenemedi');
  }
}
