import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Tekil yorum moderasyonu (W1-D, panel). Yalnızca B/A (requireLevel('B')).
 * PATCH { status } — onayla/reddet/spam işaretle; audit'lenir.
 * DELETE — yorumu kalıcı siler (kuyruk temizliği); audit'lenir.
 */

const patchSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'spam']),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const { status } = await parseBody(request, patchSchema);

    const existing = await prisma.siteComment.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) throw new ApiError(404, 'Yorum bulunamadı.');

    const updated = await prisma.siteComment.update({ where: { id }, data: { status } });

    await audit(session, 'comment.moderate', 'SiteComment', id, `${existing.status} → ${status}`);
    return NextResponse.json({ ok: true, comment: { id: updated.id, status: updated.status } });
  } catch (error) {
    return handleApiError(error, 'Yorum güncellenemedi');
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;

    const existing = await prisma.siteComment.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'Yorum bulunamadı.');

    await prisma.siteComment.delete({ where: { id } });

    await audit(session, 'comment.delete', 'SiteComment', id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'Yorum silinemedi');
  }
}
