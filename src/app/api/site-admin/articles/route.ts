import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, getPagination } from '@/lib/api';
import { audit } from '@/lib/audit';
import { slugifyTr, stripHtml } from '@/lib/site';
import { normalizeDistrict } from '@/lib/districts';

/** Foto galeri öğesi ({url, alt}) — JSON dizi olarak saklanır. */
const galleryItem = z.object({
  url: z.string().min(1),
  alt: z.string().optional().nullable(),
});

/** Site haberi oluşturma şeması (site-admin modülüne özel — schemas.ts'e dokunulmaz). */
const articleCreate = z.object({
  title: z.string().min(1),
  slug: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  body: z.string().min(1),
  categorySlug: z.string().optional().nullable(),
  // İlçe: serbest metin/slug kabul edilir, handler normalizeDistrict ile slug'a indirger (tanınmazsa null).
  district: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  gallery: z.array(galleryItem).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  imageAlt: z.string().optional().nullable(),
  imageIsAi: z.boolean().optional(),
  videoUrl: z.string().optional().nullable(),
  authorName: z.string().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  newsType: z.enum(['breaking', 'daily', 'weekly', 'manual']).optional(),
  isBreaking: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isEditorPick: z.boolean().optional(),
  seoTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  // Basın hukuku: düzeltme/geri çekme notları. Tarih damgaları (correctedAt/
  // retractedAt) SUNUCU tarafından atılır — istemci değeri güvenilmezdir.
  correctionNote: z.string().optional().nullable(),
  correctedAt: z.string().optional().nullable(),
  retractionNote: z.string().optional().nullable(),
  retractedAt: z.string().optional().nullable(),
});

/** Benzersiz slug üretir: çakışmada -2, -3... eki dener. */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugifyTr(base) || 'haber';
  let slug = root;
  for (let i = 2; ; i++) {
    const existing = await prisma.siteArticle.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    slug = `${root}-${i}`;
  }
}

/** Kategori var mı? Yoksa null döner (FK hatasını önler). */
async function safeCategorySlug(slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null;
  const cat = await prisma.siteCategory.findUnique({ where: { slug }, select: { slug: true } });
  return cat ? cat.slug : null;
}

/** GET — haber listesi: ?status=published|draft|archived|all, ?category=, ?q=, sayfalama. */
export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const category = url.searchParams.get('category') || '';
    const q = (url.searchParams.get('q') || '').trim();
    const pagination = getPagination(request);

    const where = {
      deletedAt: null,
      ...(status !== 'all' ? { status } : {}),
      ...(category ? { categorySlug: category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { summary: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total, grouped, viewsAgg] = await Promise.all([
      prisma.siteArticle.findMany({
        where,
        orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        // body ve imageUrl (data URI olabilir) listede taşınmaz — satırlar hafif kalır
        select: {
          id: true, slug: true, title: true, summary: true, categorySlug: true,
          category: { select: { name: true, color: true } },
          tags: true, imageAlt: true, imageIsAi: true, videoUrl: true,
          authorName: true, status: true, newsType: true,
          isBreaking: true, isFeatured: true, isEditorPick: true,
          publishedAt: true, views: true, sourceDraftId: true, wpId: true,
          createdAt: true, updatedAt: true,
        },
        ...(pagination ?? {}),
      }),
      prisma.siteArticle.count({ where }),
      prisma.siteArticle.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.siteArticle.aggregate({ where: { deletedAt: null }, _sum: { views: true } }),
    ]);

    const counts: Record<string, number> = { published: 0, draft: 0, archived: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;

    return NextResponse.json({ items, total, counts, totalViews: viewsAgg._sum.views ?? 0 });
  } catch (error) {
    return handleApiError(error, 'Haberler alınamadı');
  }
}

/** POST — yeni haber oluşturur (slug çakışmasında -2 eki). */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, articleCreate);

    const slug = await uniqueSlug(body.slug || body.title);
    const status = body.status || 'draft';

    // Düzeltme/geri çekme: not doluysa tarihi sunucu damgalar
    const correctionNote = body.correctionNote?.trim() || null;
    const retractionNote = body.retractionNote?.trim() || null;

    const created = await prisma.siteArticle.create({
      data: {
        slug,
        title: body.title,
        summary: body.summary || stripHtml(body.body, 180),
        body: body.body,
        categorySlug: await safeCategorySlug(body.categorySlug),
        district: normalizeDistrict(body.district),
        tags: body.tags ? JSON.stringify(body.tags) : null,
        gallery: body.gallery && body.gallery.length ? JSON.stringify(body.gallery) : null,
        imageUrl: body.imageUrl || null,
        imageAlt: body.imageAlt || null,
        imageIsAi: body.imageIsAi ?? false,
        videoUrl: body.videoUrl || null,
        authorName: body.authorName || session.name || 'Çanakkale Network',
        authorId: session.sub,
        status,
        newsType: body.newsType || 'manual',
        isBreaking: body.isBreaking ?? false,
        isFeatured: body.isFeatured ?? false,
        isEditorPick: body.isEditorPick ?? false,
        publishedAt: status === 'published' ? new Date() : null,
        seoTitle: body.seoTitle || null,
        metaDescription: body.metaDescription || null,
        correctionNote,
        correctedAt: correctionNote ? new Date() : null,
        retractionNote,
        retractedAt: retractionNote ? new Date() : null,
      },
    });

    await audit(session, 'created', 'siteArticle', created.id, `Site haberi oluşturuldu: ${created.title}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Haber oluşturulamadı');
  }
}
