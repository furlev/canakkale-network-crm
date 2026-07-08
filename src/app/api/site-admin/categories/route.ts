import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { slugifyTr } from '@/lib/site';

const categoryCreate = z.object({
  slug: z.string().optional().nullable(),
  name: z.string().min(1),
  color: z.string().optional().nullable(),
  order: z.coerce.number().int().optional(),
  showInNav: z.boolean().optional(),
});

/** GET — kategoriler (sıraya göre) + makale sayıları. */
export async function GET() {
  try {
    await requireLevel('B');
    const categories = await prisma.siteCategory.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { articles: { where: { deletedAt: null } } } } },
    });
    return NextResponse.json(
      categories.map((c) => ({
        slug: c.slug, name: c.name, color: c.color, order: c.order,
        showInNav: c.showInNav, articleCount: c._count.articles,
      }))
    );
  } catch (error) {
    return handleApiError(error, 'Kategoriler alınamadı');
  }
}

/** POST — yeni kategori. */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, categoryCreate);

    const slug = slugifyTr(body.slug || body.name);
    if (!slug) throw new ApiError(400, 'Geçerli bir slug üretilemedi');

    const created = await prisma.siteCategory.create({
      data: {
        slug,
        name: body.name,
        color: body.color || null,
        order: body.order ?? 0,
        showInNav: body.showInNav ?? true,
      },
    });

    await audit(session, 'created', 'siteCategory', created.slug, `Site kategorisi oluşturuldu: ${created.name}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Kategori oluşturulamadı');
  }
}
