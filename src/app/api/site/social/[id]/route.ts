import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { audit } from '@/lib/audit';

const PLATFORMS = ['instagram', 'x', 'facebook'] as const;
const STATUSES = ['queued', 'posted', 'skipped'] as const;

const socialUpdate = z.object({
  articleId: z.string().optional().nullable(),
  platform: z.enum(PLATFORMS).optional(),
  text: z.string().min(1).max(5000).optional(),
  status: z.enum(STATUSES).optional(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, socialUpdate);
    const params = await context.params;

    const data: {
      articleId?: string | null;
      platform?: string;
      text?: string;
      status?: string;
      postedAt?: Date | null;
    } = {};
    if (body.articleId !== undefined) data.articleId = body.articleId || null;
    if (body.platform !== undefined) data.platform = body.platform;
    if (body.text !== undefined) data.text = body.text;
    if (body.status !== undefined) {
      data.status = body.status;
      // 'posted' → şimdi damgala; diğer durumlarda paylaşım zamanı yok.
      data.postedAt = body.status === 'posted' ? new Date() : null;
    }

    const updated = await prisma.socialPost.update({ where: { id: params.id }, data });
    await audit(session, 'updated', 'socialPost', updated.id,
      `Sosyal gönderi güncellendi (${updated.platform} → ${updated.status})`);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Sosyal gönderi güncellenemedi');
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    await prisma.socialPost.delete({ where: { id: params.id } });
    await audit(session, 'deleted', 'socialPost', params.id, 'Sosyal gönderi silindi');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Sosyal gönderi silinemedi');
  }
}
