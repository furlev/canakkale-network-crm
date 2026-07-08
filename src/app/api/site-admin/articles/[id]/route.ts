import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { slugifyTr } from '@/lib/site';
import { normalizeDistrict } from '@/lib/districts';

/** Foto galeri öğesi ({url, alt}) — JSON dizi olarak saklanır. */
const galleryItem = z.object({
  url: z.string().min(1),
  alt: z.string().optional().nullable(),
});

/** Site haberi güncelleme şeması — tüm alanlar opsiyonel (kısmi güncelleme / toggle). */
const articleUpdate = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  body: z.string().min(1).optional(),
  categorySlug: z.string().optional().nullable(),
  // İlçe: serbest metin/slug — handler normalizeDistrict ile slug'a indirger.
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
  // Basın hukuku: düzeltme/geri çekme notları. Tarih damgaları SUNUCU
  // tarafından atılır (correctedAt/retractedAt istemciden okunmaz).
  correctionNote: z.string().optional().nullable(),
  correctedAt: z.string().optional().nullable(),
  retractionNote: z.string().optional().nullable(),
  retractedAt: z.string().optional().nullable(),
});

/** Benzersiz slug (kendisi hariç): çakışmada -2, -3... eki dener. */
async function uniqueSlug(base: string, excludeId: string): Promise<string> {
  const root = slugifyTr(base) || 'haber';
  let slug = root;
  for (let i = 2; ; i++) {
    const existing = await prisma.siteArticle.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const { id } = await context.params;
    const article = await prisma.siteArticle.findUnique({ where: { id } });
    if (!article || article.deletedAt) throw new ApiError(404, 'Haber bulunamadı');
    return NextResponse.json(article);
  } catch (error) {
    return handleApiError(error, 'Haber alınamadı');
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const body = await parseBody(request, articleUpdate);

    const existing = await prisma.siteArticle.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new ApiError(404, 'Haber bulunamadı');

    // Kategori verilmişse var olduğunu doğrula (FK hatasını önle)
    let categorySlug: string | null | undefined = undefined;
    if (body.categorySlug !== undefined) {
      if (body.categorySlug) {
        const cat = await prisma.siteCategory.findUnique({ where: { slug: body.categorySlug }, select: { slug: true } });
        categorySlug = cat ? cat.slug : null;
      } else {
        categorySlug = null;
      }
    }

    // Slug değişikliği: benzersizleştir (kendisi hariç)
    let slug: string | undefined = undefined;
    if (body.slug !== undefined && body.slug) {
      const wanted = slugifyTr(body.slug);
      if (wanted && wanted !== existing.slug) slug = await uniqueSlug(wanted, id);
    }

    // Yayına alınırken publishedAt yoksa şimdi ata
    const goingPublished = body.status === 'published' && !existing.publishedAt;

    // Düzeltme/geri çekme: not doluysa tarihi damgala (varsa koru), boşsa temizle.
    // Tarih daima sunucu tarafından üretilir — istemcinin correctedAt/retractedAt'ı yok sayılır.
    const pressData: {
      correctionNote?: string | null;
      correctedAt?: Date | null;
      retractionNote?: string | null;
      retractedAt?: Date | null;
    } = {};
    if (body.correctionNote !== undefined) {
      const note = body.correctionNote?.trim() || null;
      pressData.correctionNote = note;
      pressData.correctedAt = note ? (existing.correctedAt ?? new Date()) : null;
    }
    if (body.retractionNote !== undefined) {
      const note = body.retractionNote?.trim() || null;
      pressData.retractionNote = note;
      pressData.retractedAt = note ? (existing.retractedAt ?? new Date()) : null;
    }

    const updated = await prisma.siteArticle.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(body.summary !== undefined ? { summary: body.summary || null } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(categorySlug !== undefined ? { categorySlug } : {}),
        ...(body.district !== undefined ? { district: normalizeDistrict(body.district) } : {}),
        ...(body.gallery !== undefined
          ? { gallery: body.gallery && body.gallery.length ? JSON.stringify(body.gallery) : null }
          : {}),
        ...(body.tags !== undefined ? { tags: JSON.stringify(body.tags) } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
        ...(body.imageAlt !== undefined ? { imageAlt: body.imageAlt || null } : {}),
        ...(body.imageIsAi !== undefined ? { imageIsAi: body.imageIsAi } : {}),
        ...(body.videoUrl !== undefined ? { videoUrl: body.videoUrl || null } : {}),
        ...(body.authorName !== undefined ? { authorName: body.authorName || 'Çanakkale Network' } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.newsType !== undefined ? { newsType: body.newsType } : {}),
        ...(body.isBreaking !== undefined ? { isBreaking: body.isBreaking } : {}),
        ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
        ...(body.isEditorPick !== undefined ? { isEditorPick: body.isEditorPick } : {}),
        ...(body.seoTitle !== undefined ? { seoTitle: body.seoTitle || null } : {}),
        ...(body.metaDescription !== undefined ? { metaDescription: body.metaDescription || null } : {}),
        ...pressData,
        ...(goingPublished ? { publishedAt: new Date() } : {}),
      },
    });

    await audit(session, 'updated', 'siteArticle', id, `Site haberi güncellendi: ${updated.title}`);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Haber güncellenemedi');
  }
}

/** DELETE — soft delete (deletedAt damgalanır, site listelerinden düşer). */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const existing = await prisma.siteArticle.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new ApiError(404, 'Haber bulunamadı');

    await prisma.siteArticle.update({ where: { id }, data: { deletedAt: new Date(), status: 'archived' } });
    await audit(session, 'deleted', 'siteArticle', id, `Site haberi silindi (soft): ${existing.title}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'Haber silinemedi');
  }
}
