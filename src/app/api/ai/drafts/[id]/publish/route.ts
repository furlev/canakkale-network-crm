import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { getWpConfig, wpFetch } from '@/lib/wordpress';
import { audit } from '@/lib/audit';
import { slugifyTr, stripHtml } from '@/lib/site';

type WpCategory = { id: number; name: string; slug: string };
type WpCreatedPost = { id: number; thumbnail: string | null };

/** Taslak etiketlerini (JSON string dizi) güvenle çözer. */
function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** HTML özel karakterlerini kaçır (kaynak bloğu güvenliği). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Taslağın kaynaklarından (JSON: string linkler ya da {title?, url?} nesneleri)
 *  gövde sonuna eklenecek "Kaynaklar" HTML bloğunu üretir. Geçerli http(s) URL yoksa boş döner. */
function buildSourcesHtml(raw: string | null): string {
  if (!raw) return '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return '';
  }
  if (!Array.isArray(parsed)) return '';

  const items: { url: string; label: string }[] = [];
  for (const entry of parsed) {
    let url = '';
    let title = '';
    if (typeof entry === 'string') {
      url = entry;
    } else if (entry && typeof entry === 'object') {
      const o = entry as { url?: unknown; title?: unknown };
      if (typeof o.url === 'string') url = o.url;
      if (typeof o.title === 'string') title = o.title;
    }
    if (!/^https?:\/\//i.test(url)) continue; // yalnızca geçerli http(s) linkler
    let label = title.trim();
    if (!label) {
      try { label = new URL(url).hostname.replace(/^www\./, ''); } catch { label = url; }
    }
    items.push({ url, label });
  }
  if (items.length === 0) return '';

  const lis = items
    .map((s) => `<li><a href="${escapeHtml(s.url)}" rel="nofollow noopener" target="_blank">${escapeHtml(s.label)}</a></li>`)
    .join('');
  return `<hr /><p><strong>Kaynaklar:</strong></p><ul>${lis}</ul>`;
}

/** Benzersiz site slug'ı: çakışmada -2, -3... eki dener. */
async function uniqueSiteSlug(base: string): Promise<string> {
  const root = slugifyTr(base) || 'haber';
  let slug = root;
  for (let i = 2; ; i++) {
    const existing = await prisma.siteArticle.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    slug = `${root}-${i}`;
  }
}

/** Taslağın kategori metnini mevcut SiteCategory'lerle eşler (ad/slug benzerliği).
 *  Eşleşme yoksa 'genel' varsa onu, o da yoksa null döner. */
async function matchSiteCategory(draftCategory: string | null): Promise<string | null> {
  const categories = await prisma.siteCategory.findMany({ select: { slug: true, name: true } });
  if (draftCategory && draftCategory.trim()) {
    const wantedSlug = slugifyTr(draftCategory);
    const wantedName = draftCategory.trim().toLocaleLowerCase('tr-TR');
    const exact = categories.find(
      (c) => c.slug === wantedSlug || slugifyTr(c.name) === wantedSlug || c.name.trim().toLocaleLowerCase('tr-TR') === wantedName
    );
    if (exact) return exact.slug;
    // Gevşek benzerlik: biri diğerini kapsıyorsa (ör. "spor" ↔ "spor-haberleri")
    const partial = categories.find(
      (c) => wantedSlug.length >= 4 && (c.slug.includes(wantedSlug) || wantedSlug.includes(c.slug))
    );
    if (partial) return partial.slug;
  }
  return categories.find((c) => c.slug === 'genel')?.slug ?? null;
}

/**
 * Taslağı yayınlar. Varsayılan hedef SİTE (canakkale.network);
 * body {target: 'wordpress'} ile eski WordPress akışı korunur.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    // Body opsiyonel: {target?: 'site'|'wordpress'} — varsayılan site
    let target: 'site' | 'wordpress' = 'site';
    try {
      const body = (await request.json()) as { target?: string } | null;
      if (body?.target === 'wordpress') target = 'wordpress';
    } catch { /* boş gövde = varsayılan */ }

    const { id } = await context.params;
    const draft = await prisma.aiDraft.findUnique({ where: { id } });
    if (!draft) throw new ApiError(404, 'Taslak bulunamadı');

    // Idempotency + onay akışı: zaten yayınlanmışı tekrar yayınlama, reddedilmişi/boşu engelle
    if (draft.status === 'published' && (draft.wpId || draft.articleId)) {
      throw new ApiError(409, draft.articleId
        ? 'Bu taslak zaten sitede yayınlanmış'
        : 'Bu taslak zaten yayınlanmış (WP #' + draft.wpId + ')');
    }
    if (draft.status === 'rejected') {
      throw new ApiError(409, 'Reddedilmiş taslak yayınlanamaz');
    }
    if (!draft.body || !draft.body.trim()) {
      throw new ApiError(400, 'Taslak gövdesi boş — yayınlanamaz');
    }
    // TS daralması transaction closure'ına taşınmadığı için gövdeyi burada sabitle.
    const draftBody: string = draft.body;

    // ─── Varsayılan yol: SİTE (canakkale.network) ───
    if (target === 'site') {
      const slug = await uniqueSiteSlug(draft.title || draft.topic);
      const categorySlug = await matchSiteCategory(draft.category);

      // Atomik claim + oluşturma tek transaction'da: çift tıklama / iki sekme
      // yarışında yalnızca bir istek taslağı 'published'a çevirebilir; diğeri
      // updateMany count===0 ile 409 alır → tek bir SiteArticle oluşur.
      const { article, updated } = await prisma.$transaction(async (tx) => {
        const claim = await tx.aiDraft.updateMany({
          where: { id: draft.id, status: { not: 'published' } },
          data: {
            status: 'published',
            reviewerId: session?.sub ?? null,
            reviewerName: session?.name ?? null,
          },
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
            tags: draft.tags,
            imageUrl: draft.imageUrl,
            imageAlt: draft.title ? `${draft.title} (temsili görsel)` : null,
            imageIsAi: !!draft.imageUrl && draft.imageUrl.startsWith('data:'),
            authorName: session?.name || 'Çanakkale Network',
            authorId: session?.sub ?? null,
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

      const siteUrl = `https://canakkale.network/haber/${article.slug}`;
      await audit(session, 'published', 'aiDraft', draft.id, `AI taslağı siteye yayınlandı (${article.slug}): ${article.title}`);
      return NextResponse.json({ ok: true, target: 'site', articleId: article.id, slug: article.slug, siteUrl, draft: updated });
    }

    // ─── İkincil yol: WordPress (mevcut davranış) ───
    // WP yapılandırılmamışsa getWpConfig dostça 400 fırlatır — handleApiError yakalar
    const config = await getWpConfig();

    // Kategori adını connector /categories ile id'ye çevir (eşleşme yoksa kategoriyi atla)
    let categories: number[] | undefined;
    if (draft.category) {
      const wpCategories = await wpFetch<WpCategory[]>(config, '/categories');
      const wanted = draft.category.trim().toLocaleLowerCase('tr-TR');
      const match = wpCategories.find((c) => c.name.trim().toLocaleLowerCase('tr-TR') === wanted);
      if (match) categories = [match.id];
    }

    // Şeffaflık: gövde sonuna kaynak bloğu ekle (taslağın DB'deki gövdesi DEĞİŞMEZ)
    const sourcesHtml = buildSourcesHtml(draft.sources);

    const created = await wpFetch<WpCreatedPost>(config, '/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: draft.title || draft.topic,
        content: (draft.body || '') + sourcesHtml,
        status: 'publish',
        excerpt: draft.metaDescription || undefined,
        tags: parseTags(draft.tags),
        ...(categories ? { categories } : {}),
        // Öne çıkan "temsili" görsel — connector base64'ü sideload eder
        ...(draft.imageUrl ? { featured_image_base64: draft.imageUrl } : {}),
        // SEO (Yoast/Rank Math/AIOSEO)
        ...(draft.seoTitle ? { seo_title: draft.seoTitle } : {}),
        ...(draft.metaDescription ? { meta_description: draft.metaDescription } : {}),
      }),
    }, 45000); // görsel sideload + attachment metadata için daha uzun timeout

    // Kısmi başarı görünürlüğü: görsel gönderildi ama WP'ye eklenmediyse editörü uyar
    const warnings: string[] = [];
    if (draft.imageUrl && !created.thumbnail) {
      warnings.push('Görsel WordPress\'e yüklenemedi (boyut/tür sınırı olabilir); haber görselsiz yayınlandı.');
    }

    const updated = await prisma.aiDraft.update({
      where: { id: draft.id },
      data: {
        status: 'published',
        wpId: created.id,
        reviewerId: session?.sub ?? null,
        reviewerName: session?.name ?? null,
      },
    });

    await audit(session, 'published', 'aiDraft', draft.id, `AI taslağı WordPress'e yayınlandı (WP #${created.id}): ${draft.title || draft.topic}`);
    return NextResponse.json({ ok: true, target: 'wordpress', wpId: created.id, imageAttached: !!created.thumbnail, warnings, draft: updated });
  } catch (error) {
    return handleApiError(error, 'Taslak yayınlanamadı');
  }
}
