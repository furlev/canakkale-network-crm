import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { requireSiteEditor } from '@/lib/access';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { notify } from '@/lib/notify';
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
  authorSlug: z.string().optional().nullable(), // yazar hub bağı (Author.slug)
  // awaiting_approval = C editörün onaya gönderdiği; scheduled = ileri tarihli planlı yayın.
  status: z.enum(['draft', 'published', 'archived', 'awaiting_approval', 'scheduled']).optional(),
  scheduledAt: z.string().optional().nullable(), // ISO tarih — status='scheduled' için planlı yayın anı
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

/**
 * Son dakika haberi yayınlanınca ilçe-hedefli web push'u best-effort tetikler.
 * `breakingPushedAt` atomik claim'i mükerrer gönderimi engeller. CRON_SECRET yoksa
 * veya herhangi bir hata olursa sessizce atlanır — haber güncellemesini bozmaz.
 */
async function tryBreakingPush(
  request: Request,
  article: { id: string; title: string; slug: string; district: string | null },
): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  // Atomik claim — yalnız bir istek push tetikler.
  const claim = await prisma.siteArticle.updateMany({
    where: { id: article.id, breakingPushedAt: null },
    data: { breakingPushedAt: new Date() },
  });
  if (claim.count === 0) return; // başka bir yol/istek zaten tetikledi
  try {
    const endpoint = new URL('/api/site/push/send', request.url).toString();
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        title: 'Son dakika',
        body: article.title.slice(0, 300),
        url: `/haber/${article.slug}`,
        district: article.district ?? undefined,
        tag: `breaking-${article.slug}`,
      }),
    });
  } catch {
    /* push kritik değil — sessiz geç (damga kalır, tekrar denenmez) */
  }
}

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
    await requireSiteEditor();
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
    const session = await requireSiteEditor();
    const { id } = await context.params;
    const body = await parseBody(request, articleUpdate);

    const existing = await prisma.siteArticle.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new ApiError(404, 'Haber bulunamadı');

    // Yetki-farkında durum + planlama çözümü. status verilmediyse dokunulmaz.
    // C (yayınlayamaz): yeni 'published'/'scheduled' → 'awaiting_approval'. Zaten
    // yayında olan haberi C'nin salt düzenlemesi canlı haberi yayından düşürmez.
    const canPublish = isLeaderOrAdmin(session);
    let finalStatus: string | undefined = undefined;
    let scheduledAt: Date | null | undefined = undefined;
    if (body.status !== undefined) {
      let s: string = body.status;
      let sched: Date | null = null;
      if (s === 'scheduled') {
        const d = body.scheduledAt ? new Date(body.scheduledAt) : null;
        if (d && !isNaN(d.getTime()) && d.getTime() > Date.now()) sched = d;
        else s = 'draft'; // geçersiz/geçmiş tarih → planlama iptal
      }
      if (!canPublish) {
        if (s === 'published' && existing.status !== 'published') s = 'awaiting_approval';
        else if (s === 'scheduled') { s = 'awaiting_approval'; sched = null; }
      }
      finalStatus = s;
      scheduledAt = s === 'scheduled' ? sched : null; // scheduled değilse planlamayı temizle
    }

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

    // Yayına alınırken publishedAt yoksa şimdi ata (nihai duruma göre)
    const goingPublished = finalStatus === 'published' && !existing.publishedAt;

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
        ...(body.authorSlug !== undefined ? { authorSlug: body.authorSlug?.trim() || null } : {}),
        ...(finalStatus !== undefined ? { status: finalStatus } : {}),
        ...(scheduledAt !== undefined ? { scheduledAt } : {}),
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
    // Yeni onaya düştüyse B/A'ya bildir (yayın onay kuyruğu)
    if (finalStatus === 'awaiting_approval' && existing.status !== 'awaiting_approval') {
      await notify('site_approval', `Onay bekleyen haber: ${updated.title} (${session.name || 'Editör'})`, `/site-yonetimi/haber/${id}`);
    }
    // Son dakika olarak yayınlandıysa web push'u best-effort tetikle (bir kez).
    if (updated.status === 'published' && updated.isBreaking && !existing.breakingPushedAt) {
      await tryBreakingPush(request, { id, title: updated.title, slug: updated.slug, district: updated.district });
    }
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
