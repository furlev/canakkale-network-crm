import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

const categoryUpdate = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional().nullable(),
  order: z.coerce.number().int().optional(),
  showInNav: z.boolean().optional(),
});

export async function PUT(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireLevel('B');
    const { slug } = await context.params;
    const body = await parseBody(request, categoryUpdate);

    const existing = await prisma.siteCategory.findUnique({ where: { slug } });
    if (!existing) throw new ApiError(404, 'Kategori bulunamadı');

    const updated = await prisma.siteCategory.update({
      where: { slug },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.color !== undefined ? { color: body.color || null } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
        ...(body.showInNav !== undefined ? { showInNav: body.showInNav } : {}),
      },
    });

    await audit(session, 'updated', 'siteCategory', slug, `Site kategorisi güncellendi: ${updated.name}`);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Kategori güncellenemedi');
  }
}

/** DELETE — kategoriyi siler; bağlı makalelerin kategorisi boşa düşer (SetNull). */
export async function DELETE(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireLevel('B');
    const { slug } = await context.params;
    const existing = await prisma.siteCategory.findUnique({
      where: { slug },
      include: { _count: { select: { articles: true } } },
    });
    if (!existing) throw new ApiError(404, 'Kategori bulunamadı');

    // Şema onDelete: SetNull — makaleler silinmez, kategorisiz kalır
    await prisma.siteCategory.delete({ where: { slug } });
    await audit(
      session, 'deleted', 'siteCategory', slug,
      `Site kategorisi silindi: ${existing.name} (${existing._count.articles} makale kategorisiz kaldı)`
    );
    return NextResponse.json({ ok: true, orphanedArticles: existing._count.articles });
  } catch (error) {
    return handleApiError(error, 'Kategori silinemedi');
  }
}
