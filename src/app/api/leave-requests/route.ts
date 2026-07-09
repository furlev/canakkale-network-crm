import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError, requireLevel } from '@/lib/api';
import { isLeaderOrAdmin, isAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';

/* ── İK-lite: izin talepleri (modül-yerel zod) ── */
const leaveCreate = z
  .object({
    type: z.enum(['annual', 'sick', 'unpaid', 'other']).default('annual'),
    startDate: z.string().refine(v => !Number.isNaN(new Date(v).getTime()), { message: 'Geçersiz başlangıç tarihi' }),
    endDate: z.string().refine(v => !Number.isNaN(new Date(v).getTime()), { message: 'Geçersiz bitiş tarihi' }),
    note: z.string().max(500).optional().nullable(),
  })
  .refine(b => new Date(b.endDate).getTime() >= new Date(b.startDate).getTime(), {
    message: 'Bitiş tarihi başlangıçtan önce olamaz',
    path: ['endDate'],
  });

/** Belirli bir kullanıcıya bildirim (fire-and-forget; asıl işlemi bozmaz). */
async function notifyUser(userId: string, title: string, link?: string): Promise<void> {
  try {
    await prisma.notification.create({
      data: { type: 'info', title, link: link || null, userId, category: 'hr' },
    });
  } catch (error) {
    console.error('[leave notify]', error);
  }
}

/**
 * GET izin talepleri.
 *   ?scope=mine (varsayılan) → yalnız kendi taleplerim
 *   ?scope=team → lider/yönetici: admin tümünü, editör kendi ekibini (+ onayında olduğu) görür
 */
export async function GET(request: Request) {
  try {
    const session = await requireLevel('C');
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'mine';

    if (scope === 'team') {
      if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Ekip izinleri için lider/yönetici yetkisi gerekli');
      let where: Record<string, unknown> = {};
      if (!isAdmin(session)) {
        // Editör: yalnız kendi ekibinin veya onayında olduğu talepler
        const team = await prisma.user.findMany({ where: { managerId: session.sub }, select: { id: true } });
        const ids = team.map(t => t.id);
        where = { OR: [{ userId: { in: ids } }, { approverId: session.sub }] };
      }
      const items = await prisma.leaveRequest.findMany({
        where,
        orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
        take: 300,
      });
      return NextResponse.json(await withUsers(items));
    }

    const items = await prisma.leaveRequest.findMany({
      where: { userId: session.sub },
      orderBy: { startDate: 'desc' },
      take: 200,
    });
    return NextResponse.json(await withUsers(items));
  } catch (error) {
    return handleApiError(error, 'İzin talepleri alınamadı');
  }
}

/** Talep listesine kullanıcı adlarını (userId → name/title) ekler — @relation yok, düz id. */
async function withUsers<T extends { userId: string }>(items: T[]): Promise<(T & { user: { id: string; name: string; title: string | null } | null })[]> {
  const ids = [...new Set(items.map(i => i.userId))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, title: true } })
    : [];
  const map = new Map(users.map(u => [u.id, u]));
  return items.map(i => ({ ...i, user: map.get(i.userId) ?? null }));
}

/** POST — kendi izin talebini oluştur (C ve üstü). Yöneticiye bildirim düşer. */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('C');
    const body = await parseBody(request, leaveCreate);

    // Onaylayıcı: talep sahibinin yöneticisi (varsa)
    const me = await prisma.user.findUnique({ where: { id: session.sub }, select: { managerId: true, name: true } });
    const approverId = me?.managerId ?? null;

    const created = await prisma.leaveRequest.create({
      data: {
        userId: session.sub,
        type: body.type,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        note: body.note || null,
        approverId,
        status: 'pending',
      },
    });

    const label = `${me?.name || 'Bir ekip üyesi'} izin talebi oluşturdu`;
    if (approverId) {
      await notifyUser(approverId, label, '/team');
    } else {
      // Yönetici yoksa tüm A kullanıcılarına düşür
      const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
      await Promise.all(admins.map(a => notifyUser(a.id, label, '/team')));
    }
    await audit(session, 'created', 'leaveRequest', created.id, `İzin talebi (${body.type}) ${body.startDate} → ${body.endDate}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'İzin talebi oluşturulamadı');
  }
}
