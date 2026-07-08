import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { audit } from '@/lib/audit';
import { slugifyTr } from '@/lib/site';

const pageCreate = z.object({
  title: z.string().min(1),
  slug: z.string().optional().nullable(),
  content: z.string(),
  status: z.enum(['published', 'hidden']).optional(),
  seoTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
});

/** Benzersiz sayfa slug'ı: çakışmada -2, -3... eki dener. */
async function uniquePageSlug(base: string): Promise<string> {
  const root = slugifyTr(base) || 'sayfa';
  let slug = root;
  for (let i = 2; ; i++) {
    const existing = await prisma.sitePage.findUnique({ where: { slug }, select: { slug: true } });
    if (!existing) return slug;
    slug = `${root}-${i}`;
  }
}

/** GET — tüm statik sayfalar. */
export async function GET() {
  try {
    await requireLevel('B');
    const pages = await prisma.sitePage.findMany({ orderBy: { title: 'asc' } });
    return NextResponse.json(pages);
  } catch (error) {
    return handleApiError(error, 'Sayfalar alınamadı');
  }
}

/** POST — yeni statik sayfa. */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, pageCreate);

    const slug = await uniquePageSlug(body.slug || body.title);
    const created = await prisma.sitePage.create({
      data: {
        slug,
        title: body.title,
        content: body.content,
        status: body.status || 'published',
        seoTitle: body.seoTitle || null,
        metaDescription: body.metaDescription || null,
        updatedBy: session.name || session.email || null,
      },
    });

    await audit(session, 'created', 'sitePage', created.slug, `Site sayfası oluşturuldu: ${created.title}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Sayfa oluşturulamadı');
  }
}
