import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

/** NOT: Author birincil anahtarı slug'dır; [id] parametresi burada slug'ı taşır. */

const authorUpdate = z.object({
  name: z.string().min(1).max(120).optional(),
  bio: z.string().max(2000).optional().nullable(),
  avatar: z.string().max(1000).optional().nullable(),
  title: z.string().max(120).optional().nullable(),
  isColumnist: z.boolean().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const { id } = await context.params;
    const author = await prisma.author.findUnique({ where: { slug: id } });
    if (!author) throw new ApiError(404, 'Yazar bulunamadı');
    return NextResponse.json(author);
  } catch (error) {
    return handleApiError(error, 'Yazar alınamadı');
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const body = await parseBody(request, authorUpdate);

    const existing = await prisma.author.findUnique({ where: { slug: id } });
    if (!existing) throw new ApiError(404, 'Yazar bulunamadı');

    const updated = await prisma.author.update({
      where: { slug: id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.bio !== undefined ? { bio: body.bio?.trim() || null } : {}),
        ...(body.avatar !== undefined ? { avatar: body.avatar?.trim() || null } : {}),
        ...(body.title !== undefined ? { title: body.title?.trim() || null } : {}),
        ...(body.isColumnist !== undefined ? { isColumnist: body.isColumnist } : {}),
      },
    });

    await audit(session, 'updated', 'author', id, `Yazar güncellendi: ${updated.name}`);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Yazar güncellenemedi');
  }
}

/** DELETE — yazarı siler. Haberlerin authorSlug'ı olduğu gibi kalır (gevşek bağ). */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const existing = await prisma.author.findUnique({ where: { slug: id } });
    if (!existing) throw new ApiError(404, 'Yazar bulunamadı');

    await prisma.author.delete({ where: { slug: id } });
    await audit(session, 'deleted', 'author', id, `Yazar silindi: ${existing.name}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'Yazar silinemedi');
  }
}
