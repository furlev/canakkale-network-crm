import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Tekil canlı blog — detay (girişlerle) + güncelle (başlık/durum) + sil.
 * requireLevel('B'), audit. Durum: 'active' → 'ended' (yayını bitir).
 */

const updateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  status: z.enum(['active', 'ended']).optional(),
  articleId: z.string().trim().max(60).optional().nullable(),
});

/** GET — canlı blog + tüm girişleri (yeni→eski). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const { id } = await context.params;
    const blog = await prisma.liveBlog.findUnique({ where: { id } });
    if (!blog) throw new ApiError(404, 'Canlı blog bulunamadı');

    const entries = await prisma.liveBlogEntry.findMany({
      where: { liveBlogId: id },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return NextResponse.json({ ...blog, entries });
  } catch (error) {
    return handleApiError(error, 'Canlı blog alınamadı');
  }
}

/** PUT — başlık/durum/ilişkili haber güncelle. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const body = await parseBody(request, updateSchema);

    const existing = await prisma.liveBlog.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Canlı blog bulunamadı');

    const updated = await prisma.liveBlog.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.articleId !== undefined ? { articleId: body.articleId?.trim() || null } : {}),
      },
    });

    const detail =
      body.status === 'ended' && existing.status !== 'ended'
        ? `Canlı blog sona erdirildi: ${updated.title}`
        : `Canlı blog güncellendi: ${updated.title}`;
    await audit(session, 'updated', 'liveBlog', id, detail);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Canlı blog güncellenemedi');
  }
}

/** DELETE — canlı blog + girişlerini kalıcı sil (soft-delete alanı yok). */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const existing = await prisma.liveBlog.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Canlı blog bulunamadı');

    await prisma.liveBlogEntry.deleteMany({ where: { liveBlogId: id } });
    await prisma.liveBlog.delete({ where: { id } });

    await audit(session, 'deleted', 'liveBlog', id, `Canlı blog silindi: ${existing.title}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'Canlı blog silinemedi');
  }
}
