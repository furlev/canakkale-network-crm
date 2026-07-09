import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { slugifyTr } from '@/lib/site';

/**
 * Canlı blog yönetimi — liste + oluştur (requireLevel('B'), audit).
 * LiveBlog.slug birincil kimliktir; public sayfa /canli/[slug] ve poll ucu
 * /api/site/liveblog/[slug] bu slug ile besler.
 */

const createSchema = z.object({
  title: z.string().trim().min(3, 'Başlık en az 3 karakter olmalı').max(200),
  slug: z.string().trim().max(200).optional().nullable(),
  articleId: z.string().trim().max(60).optional().nullable(),
});

/** Benzersiz slug: çakışmada -2, -3... dener. */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugifyTr(base) || 'canli';
  let slug = root;
  for (let i = 2; ; i++) {
    const existing = await prisma.liveBlog.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    slug = `${root}-${i}`;
  }
}

/** GET — canlı bloglar (aktif önce), her biri için giriş sayısı + son giriş anı. */
export async function GET() {
  try {
    await requireLevel('B');
    const [blogs, grouped] = await Promise.all([
      prisma.liveBlog.findMany({ orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }] }),
      prisma.liveBlogEntry.groupBy({
        by: ['liveBlogId'],
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ]);
    const stats: Record<string, { count: number; lastAt: Date | null }> = {};
    for (const g of grouped) stats[g.liveBlogId] = { count: g._count._all, lastAt: g._max.createdAt };

    return NextResponse.json(
      blogs.map((b) => ({
        ...b,
        entryCount: stats[b.id]?.count ?? 0,
        lastEntryAt: stats[b.id]?.lastAt ?? null,
      }))
    );
  } catch (error) {
    return handleApiError(error, 'Canlı bloglar alınamadı');
  }
}

/** POST — yeni canlı blog. slug verilmezse başlıktan üretilir. */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, createSchema);

    const slug = await uniqueSlug(body.slug || body.title);
    if (!slug) throw new ApiError(400, 'Geçerli bir slug üretilemedi');

    const created = await prisma.liveBlog.create({
      data: {
        slug,
        title: body.title.trim(),
        status: 'active',
        articleId: body.articleId?.trim() || null,
      },
    });

    await audit(session, 'created', 'liveBlog', created.id, `Canlı blog oluşturuldu: ${created.title}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Canlı blog oluşturulamadı');
  }
}
