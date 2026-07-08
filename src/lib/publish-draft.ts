import prisma from '@/lib/prisma';
import { ApiError } from '@/lib/api';
import { slugifyTr, stripHtml } from '@/lib/site';
import { storeDataUri } from '@/lib/storage';

/**
 * AiDraft → SiteArticle yayınlama çekirdeği. Hem /api/ai/drafts/[id]/publish rotası
 * (elle/anlık) hem /api/cron/publish-scheduled (planlı) tarafından kullanılır.
 *
 * - Atomik claim (updateMany status!=published) ile çift-yayın engellenir.
 * - AI görseli (data-URI) varsa object storage'a taşınır (storeDataUri); Spaces
 *   yapılandırılmamışsa data-URI korunur (fallback — /site/img endpoint'i çalışır).
 */

/** Benzersiz site slug'ı: çakışmada -2, -3... */
export async function uniqueSiteSlug(base: string): Promise<string> {
  const root = slugifyTr(base) || 'haber';
  let slug = root;
  for (let i = 2; ; i++) {
    const existing = await prisma.siteArticle.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    slug = `${root}-${i}`;
  }
}

/** Taslak kategorisini mevcut SiteCategory'lerle eşler; yoksa 'genel' ya da null. */
export async function matchSiteCategory(draftCategory: string | null): Promise<string | null> {
  const categories = await prisma.siteCategory.findMany({ select: { slug: true, name: true } });
  if (draftCategory && draftCategory.trim()) {
    const wantedSlug = slugifyTr(draftCategory);
    const wantedName = draftCategory.trim().toLocaleLowerCase('tr-TR');
    const exact = categories.find(
      (c) => c.slug === wantedSlug || slugifyTr(c.name) === wantedSlug || c.name.trim().toLocaleLowerCase('tr-TR') === wantedName,
    );
    if (exact) return exact.slug;
    const partial = categories.find(
      (c) => wantedSlug.length >= 4 && (c.slug.includes(wantedSlug) || wantedSlug.includes(c.slug)),
    );
    if (partial) return partial.slug;
  }
  return categories.find((c) => c.slug === 'genel')?.slug ?? null;
}

export type PublishActor = { sub?: string | null; name?: string | null };

type DraftLike = {
  id: string;
  topic: string;
  title: string | null;
  body: string | null;
  category: string | null;
  tags: string | null;
  imageUrl: string | null;
  newsType: string;
  district: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  sources: string | null;
  reviewerId?: string | null;
  reviewerName?: string | null;
};

/** Taslağı siteye yayınlar. Zaten yayınlanmışsa/gövdesi boşsa ApiError fırlatır. */
export async function publishDraftToSite(draft: DraftLike, actor: PublishActor) {
  if (!draft.body || !draft.body.trim()) {
    throw new ApiError(400, 'Taslak gövdesi boş — yayınlanamaz');
  }
  const draftBody: string = draft.body;
  const slug = await uniqueSiteSlug(draft.title || draft.topic);
  const categorySlug = await matchSiteCategory(draft.category);

  // Görseli (varsa) object storage'a taşı; imageIsAi kararı ORİJİNAL data-URI'ye göre.
  const wasAiImage = !!draft.imageUrl && draft.imageUrl.startsWith('data:');
  const imageUrl = await storeDataUri(draft.imageUrl, 'articles');

  const reviewerId = actor.sub ?? draft.reviewerId ?? null;
  const reviewerName = actor.name ?? draft.reviewerName ?? null;

  return prisma.$transaction(async (tx) => {
    const claim = await tx.aiDraft.updateMany({
      where: { id: draft.id, status: { not: 'published' } },
      data: { status: 'published', reviewerId, reviewerName },
    });
    if (claim.count === 0) {
      throw new ApiError(409, 'Bu taslak zaten yayınlanmış');
    }

    const created = await tx.siteArticle.create({
      data: {
        slug,
        title: draft.title || draft.topic,
        summary: draft.metaDescription || stripHtml(draftBody, 180),
        body: draftBody,
        categorySlug,
        district: draft.district,
        tags: draft.tags,
        imageUrl,
        imageAlt: draft.title ? `${draft.title} (temsili görsel)` : null,
        imageIsAi: wasAiImage,
        authorName: reviewerName || 'Çanakkale Network',
        authorId: reviewerId,
        status: 'published',
        newsType: draft.newsType,
        isBreaking: draft.newsType === 'breaking',
        publishedAt: new Date(),
        seoTitle: draft.seoTitle,
        metaDescription: draft.metaDescription,
        sourceDraftId: draft.id,
        sourceLinks: draft.sources,
      },
    });

    const updatedDraft = await tx.aiDraft.update({
      where: { id: draft.id },
      data: { articleId: created.id },
    });

    return { article: created, updated: updatedDraft };
  });
}
