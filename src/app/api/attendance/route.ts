import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { isLeaderOrAdmin, isAdmin } from '@/lib/permissions';

/* ── İK-lite: mesai/devam (opsiyonel giriş/çıkış) ── */
const attendancePunch = z.object({
  action: z.enum(['in', 'out']),
  note: z.string().max(300).optional().nullable(),
});

/** @db.Date için gün başını (UTC) üretir — unique [userId, date] tutarlılığı. */
function todayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * GET mesai kayıtları.
 *   ?scope=mine (varsayılan) → son kendi kayıtlarım
 *   ?scope=team → lider/yönetici: bugünün ekip kayıtları (admin tümü, editör kendi ekibi)
 */
export async function GET(request: Request) {
  try {
    const session = await requireLevel('C');
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'mine';

    if (scope === 'team') {
      if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Ekip mesai kayıtları için lider/yönetici yetkisi gerekli');
      let userFilter: Record<string, unknown> = {};
      if (!isAdmin(session)) {
        const team = await prisma.user.findMany({ where: { managerId: session.sub }, select: { id: true } });
        userFilter = { userId: { in: team.map(t => t.id) } };
      }
      const items = await prisma.attendance.findMany({
        where: { ...userFilter, date: todayDate() },
        orderBy: { checkIn: 'desc' },
        take: 200,
      });
      const ids = [...new Set(items.map(i => i.userId))];
      const users = ids.length
        ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
        : [];
      const map = new Map(users.map(u => [u.id, u]));
      return NextResponse.json(items.map(i => ({ ...i, user: map.get(i.userId) ?? null })));
    }

    const items = await prisma.attendance.findMany({
      where: { userId: session.sub },
      orderBy: { date: 'desc' },
      take: 60,
    });
    return NextResponse.json(items);
  } catch (error) {
    return handleApiError(error, 'Mesai kayıtları alınamadı');
  }
}

/** POST — bugüne giriş/çıkış damgası (kendi kaydına). */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('C');
    const body = await parseBody(request, attendancePunch);
    const date = todayDate();
    const now = new Date();

    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: session.sub, date } },
    });

    if (body.action === 'in') {
      const record = existing
        ? await prisma.attendance.update({
            where: { userId_date: { userId: session.sub, date } },
            data: { checkIn: existing.checkIn ?? now, note: body.note ?? existing.note },
          })
        : await prisma.attendance.create({
            data: { userId: session.sub, date, checkIn: now, note: body.note || null },
          });
      return NextResponse.json(record, { status: existing ? 200 : 201 });
    }

    // action === 'out'
    const record = existing
      ? await prisma.attendance.update({
          where: { userId_date: { userId: session.sub, date } },
          data: { checkOut: now, note: body.note ?? existing.note },
        })
      : await prisma.attendance.create({
          data: { userId: session.sub, date, checkOut: now, note: body.note || null },
        });
    return NextResponse.json(record);
  } catch (error) {
    return handleApiError(error, 'Mesai kaydı işlenemedi');
  }
}
