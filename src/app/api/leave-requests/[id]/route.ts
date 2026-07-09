import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError, requireLevel } from '@/lib/api';
import { isLeaderOrAdmin, isAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';

const leaveDecide = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().max(500).optional().nullable(),
});

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
 * Talep sahibinin yöneticisi mi / yetkili mi?
 *   A → her talebi onaylayabilir
 *   B → yalnız kendi ekibinin (managerId === self) veya onayına atanmış talepleri
 */
async function canDecide(session: { sub: string; role: string }, requesterId: string, approverId: string | null): Promise<boolean> {
  if (isAdmin(session)) return true;
  if (!isLeaderOrAdmin(session)) return false;
  if (approverId === session.sub) return true;
  const requester = await prisma.user.findUnique({ where: { id: requesterId }, select: { managerId: true } });
  return requester?.managerId === session.sub;
}

/** PATCH — izin talebini onayla/reddet (yönetici). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await params;
    const body = await parseBody(request, leaveDecide);

    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'İzin talebi bulunamadı');
    if (!(await canDecide(session, existing.userId, existing.approverId))) {
      throw new ApiError(403, 'Bu talebi onaylama yetkiniz yok');
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: body.status, approverId: session.sub, note: body.note ?? existing.note },
    });

    const verb = body.status === 'approved' ? 'onaylandı' : 'reddedildi';
    await notifyUser(existing.userId, `İzin talebiniz ${verb}`, '/team');
    await audit(session, body.status === 'approved' ? 'approved' : 'rejected', 'leaveRequest', id, `İzin talebi ${verb}`);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'İzin talebi güncellenemedi');
  }
}

/** DELETE — bekleyen talebi iptal et (sahibi veya A). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('C');
    const { id } = await params;
    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'İzin talebi bulunamadı');

    const owner = existing.userId === session.sub;
    if (!owner && !isAdmin(session)) throw new ApiError(403, 'Bu talebi silme yetkiniz yok');
    if (owner && !isAdmin(session) && existing.status !== 'pending') {
      throw new ApiError(400, 'Yalnız bekleyen talep iptal edilebilir');
    }

    await prisma.leaveRequest.delete({ where: { id } });
    await audit(session, 'deleted', 'leaveRequest', id, 'İzin talebi silindi');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'İzin talebi silinemedi');
  }
}
