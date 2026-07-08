import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { slugifyTr } from '@/lib/site';

const pageUpdate = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().optional().nullable(), // slug değişikliğine izin verilir (benzersizleştirilir)
  content: z.string().optional(),
  status: z.enum(['published', 'hidden']).optional(),
  seoTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
});

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    await requireLevel('B');
    const { slug } = await context.params;
    const page = await prisma.sitePage.findUnique({ where: { slug } });
    if (!page) throw new ApiError(404, 'Sayfa bulunamadı');
    return NextResponse.json(page);
  } catch (error) {
    return handleApiError(error, 'Sayfa alınamadı');
  }
}

export async function PUT(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireLevel('B');
    const { slug } = await context.params;
    const body = await parseBody(request, pageUpdate);

    const existing = await prisma.sitePage.findUnique({ where: { slug } });
    if (!existing) throw new ApiError(404, 'Sayfa bulunamadı');

    // Slug değişikliği: benzersizleştir (-2, -3... eki)
    let newSlug: string | undefined = undefined;
    if (body.slug !== undefined && body.slug) {
      const wanted = slugifyTr(body.slug);
      if (wanted && wanted !== slug) {
        const root = wanted;
        let candidate = root;
        for (let i = 2; ; i++) {
          const clash = await prisma.sitePage.findUnique({ where: { slug: candidate }, select: { slug: true } });
          if (!clash) break;
          candidate = `${root}-${i}`;
        }
        newSlug = candidate;
      }
    }

    const updated = await prisma.sitePage.update({
      where: { slug },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(newSlug !== undefined ? { slug: newSlug } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.seoTitle !== undefined ? { seoTitle: body.seoTitle || null } : {}),
        ...(body.metaDescription !== undefined ? { metaDescription: body.metaDescription || null } : {}),
        updatedBy: session.name || session.email || null,
      },
    });

    await audit(session, 'updated', 'sitePage', updated.slug, `Site sayfası güncellendi: ${updated.title}`);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Sayfa güncellenemedi');
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireLevel('B');
    const { slug } = await context.params;
    const existing = await prisma.sitePage.findUnique({ where: { slug } });
    if (!existing) throw new ApiError(404, 'Sayfa bulunamadı');

    await prisma.sitePage.delete({ where: { slug } });
    await audit(session, 'deleted', 'sitePage', slug, `Site sayfası silindi: ${existing.title}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'Sayfa silinemedi');
  }
}
