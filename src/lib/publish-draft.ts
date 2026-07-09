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

/** Çoklu-kanal yayın hedefleri (#30). */
export type PublishChannel = 'site' | 'newsletter' | 'social';

/** publishDraftToSite ek seçenekleri. `channels` verilmezse GERİYE UYUM: sosyal otomatik oluşur. */
export type PublishDraftOptions = {
  channels?: PublishChannel[];
};

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
  socialPost?: string | null;
  titleVariants?: string | null;
  reviewerId?: string | null;
  reviewerName?: string | null;
};

/** Görsel meta nesnesi — generate-drafts, taslağın `sources` dizisine ekler (url'siz).
 *  { meta:'image', alt, credit, isAi } */
type ImageMeta = { alt: string | null; credit: string | null; isAi: boolean };

/** Taslağın `sources` JSON'undan görsel meta nesnesini çıkarır (yoksa null). */
function parseImageMeta(raw: string | null): ImageMeta | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    for (const e of arr) {
      if (e && typeof e === 'object' && (e as { meta?: unknown }).meta === 'image') {
        const o = e as { alt?: unknown; credit?: unknown; isAi?: unknown };
        return {
          alt: typeof o.alt === 'string' && o.alt.trim() ? o.alt.trim() : null,
          credit: typeof o.credit === 'string' && o.credit.trim() ? o.credit.trim() : null,
          isAi: o.isAi === true,
        };
      }
    }
  } catch { /* bozuk JSON → meta yok */ }
  return null;
}

/** `sources` JSON'undan görsel meta nesnesini AYIKLAR (SiteArticle.sourceLinks'e sızmasın). */
function stripImageMeta(raw: string | null): string | null {
  if (!raw) return raw;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return raw;
    const cleaned = arr.filter((e) => !(e && typeof e === 'object' && (e as { meta?: unknown }).meta === 'image'));
    return JSON.stringify(cleaned);
  } catch {
    return raw;
  }
}

/** Taslağın seçilmiş A/B alt başlığını çözer. titleVariants iki şekli destekler:
 *  - dizi (üretilmiş varyantlar, seçim yok) → null
 *  - { altTitle: string, options?: string[] } (editör seçince) → altTitle */
function parseAltTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof (v as { altTitle?: unknown }).altTitle === 'string') {
      const t = (v as { altTitle: string }).altTitle.trim();
      return t || null;
    }
  } catch { /* yoksay */ }
  return null;
}

/** Yayın görseli alt metnini üretir (P2): gerçek foto → betimleyici alt + telif atfı;
 *  AI (temsili) görsel → "(temsili görsel)" etiketi. Görsel yoksa null. */
function buildImageAlt(hasImage: boolean, wasAiImage: boolean, title: string | null, meta: ImageMeta | null): string | null {
  if (!hasImage) return null;
  if (wasAiImage) {
    return title ? `${title} (temsili görsel)` : (meta?.alt || null);
  }
  // Gerçek fotoğraf: betimleyici alt (analyze'den) + kaynak atfı (telif)
  const base = meta?.alt || title || null;
  if (!base) return meta?.credit ? `Fotoğraf: ${meta.credit}` : null;
  return meta?.credit ? `${base} (Fotoğraf: ${meta.credit})` : base;
}

/**
 * Taslağı siteye yayınlar. Zaten yayınlanmışsa/gövdesi boşsa ApiError fırlatır.
 *
 * `opts.channels`:
 *  - verilmezse (undefined) → GERİYE UYUM: sosyal metin varsa otomatik SocialPost oluşur.
 *  - verilirse → SocialPost yalnızca 'social' kanalı seçildiğinde oluşur.
 * ('newsletter' kanalı bülten taslağı yayın rotasında ele alınır; burada site yayını + sosyal yönetilir.)
 */
/**
 * Son dakika haberi yayınlanınca ilçe-hedefli web push'u best-effort tetikler.
 * `breakingPushedAt` atomik claim'i ile mükerrer gönderim engellenir. CRON_SECRET
 * yoksa, son dakika değilse veya herhangi bir hata olursa sessizce atlanır — yayını bozmaz.
 * (Lib fonksiyonu request'siz çalışır; taban URL env SITE_URL fallback'inden alınır.)
 */
async function tryBreakingPush(article: {
  id: string;
  title: string;
  slug: string;
  district: string | null;
  isBreaking: boolean;
  status: string;
}): Promise<void> {
  if (!article.isBreaking || article.status !== 'published') return;
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  // Atomik claim — yalnız bir çağrı push tetikler (çift yayın/eş zamanlılık güvenli).
  const claim = await prisma.siteArticle.updateMany({
    where: { id: article.id, breakingPushedAt: null },
    data: { breakingPushedAt: new Date() },
  });
  if (claim.count === 0) return;
  try {
    const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://canakkale.network';
    const base = raw.replace(/\/+$/, '');
    await fetch(`${base}/api/site/push/send`, {
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

export async function publishDraftToSite(draft: DraftLike, actor: PublishActor, opts?: PublishDraftOptions) {
  if (!draft.body || !draft.body.trim()) {
    throw new ApiError(400, 'Taslak gövdesi boş — yayınlanamaz');
  }
  const draftBody: string = draft.body;
  const slug = await uniqueSiteSlug(draft.title || draft.topic);
  const categorySlug = await matchSiteCategory(draft.category);

  // Görseli (varsa) object storage'a taşı; imageIsAi kararı ORİJİNAL data-URI'ye göre.
  const wasAiImage = !!draft.imageUrl && draft.imageUrl.startsWith('data:');
  const imageUrl = await storeDataUri(draft.imageUrl, 'articles');

  // P2: görsel alt/telif atfı (sources meta) + A/B seçilmiş alt başlık
  const imageMeta = parseImageMeta(draft.sources);
  const imageAlt = buildImageAlt(!!imageUrl, wasAiImage, draft.title, imageMeta);
  const altTitle = parseAltTitle(draft.titleVariants);
  const sourceLinks = stripImageMeta(draft.sources);

  const reviewerId = actor.sub ?? draft.reviewerId ?? null;
  const reviewerName = actor.name ?? draft.reviewerName ?? null;

  const result = await prisma.$transaction(async (tx) => {
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
        imageAlt,
        imageIsAi: wasAiImage,
        altTitle,
        authorName: reviewerName || 'Çanakkale Network',
        authorId: reviewerId,
        status: 'published',
        newsType: draft.newsType,
        isBreaking: draft.newsType === 'breaking',
        publishedAt: new Date(),
        seoTitle: draft.seoTitle,
        metaDescription: draft.metaDescription,
        sourceDraftId: draft.id,
        sourceLinks,
      },
    });

    const updatedDraft = await tx.aiDraft.update({
      where: { id: draft.id },
      data: { articleId: created.id },
    });

    // Sosyal metin varsa kuyruğa düşür (insan sonradan /social'dan paylaşır).
    // channels verilmemişse eskisi gibi otomatik; verilmişse yalnız 'social' seçiliyse.
    const wantSocial = !opts?.channels || opts.channels.includes('social');
    if (wantSocial && draft.socialPost && draft.socialPost.trim()) {
      await tx.socialPost.create({
        data: { articleId: created.id, platform: 'instagram', text: draft.socialPost.trim(), status: 'queued' },
      });
    }

    return { article: created, updated: updatedDraft };
  });

  // Son dakika ise ilçe-hedefli web push (best-effort, transaction dışı — yayını bloklamaz).
  await tryBreakingPush(result.article);

  return result;
}
