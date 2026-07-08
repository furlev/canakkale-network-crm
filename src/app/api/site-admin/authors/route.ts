import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { slugifyTr } from '@/lib/site';

/**
 * Yazar / köşe yazarı yönetimi (yazar hub sayfalarını besler: /yazar/[slug]).
 * requireLevel('B'). Author.slug birincil anahtardır; haberler SiteArticle.authorSlug
 * ile bağlanır (gevşek bağ — ilişki tanımlı değil, slug eşleşmesiyle).
 */

const authorCreate = z.object({
  slug: z.string().optional().nullable(),
  name: z.string().min(1).max(120),
  bio: z.string().max(2000).optional().nullable(),
  avatar: z.string().max(1000).optional().nullable(),
  title: z.string().max(120).optional().nullable(),
  isColumnist: z.boolean().optional(),
});

/** GET — yazarlar (köşe yazarları önce, sonra ada göre) + haber sayıları. */
export async function GET() {
  try {
    await requireLevel('B');
    const [authors, grouped] = await Promise.all([
      prisma.author.findMany({ orderBy: [{ isColumnist: 'desc' }, { name: 'asc' }] }),
      prisma.siteArticle.groupBy({
        by: ['authorSlug'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);
    const counts: Record<string, number> = {};
    for (const g of grouped) if (g.authorSlug) counts[g.authorSlug] = g._count._all;

    return NextResponse.json(
      authors.map((a) => ({ ...a, articleCount: counts[a.slug] ?? 0 }))
    );
  } catch (error) {
    return handleApiError(error, 'Yazarlar alınamadı');
  }
}

/** POST — yeni yazar. slug verilmezse addan üretilir. */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, authorCreate);

    const slug = slugifyTr(body.slug || body.name);
    if (!slug) throw new ApiError(400, 'Geçerli bir slug üretilemedi');

    const created = await prisma.author.create({
      data: {
        slug,
        name: body.name.trim(),
        bio: body.bio?.trim() || null,
        avatar: body.avatar?.trim() || null,
        title: body.title?.trim() || null,
        isColumnist: body.isColumnist ?? false,
      },
    });

    await audit(session, 'created', 'author', created.slug, `Yazar oluşturuldu: ${created.name}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Yazar oluşturulamadı');
  }
}
