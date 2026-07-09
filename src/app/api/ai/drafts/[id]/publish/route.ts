import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { getWpConfig, wpFetch } from '@/lib/wordpress';
import { audit } from '@/lib/audit';
import { publishDraftToSite, type PublishChannel } from '@/lib/publish-draft';

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

/**
 * Taslağı yayınlar. Varsayılan hedef SİTE (canakkale.network);
 * body {target: 'wordpress'} ile eski WordPress akışı korunur.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    // Body opsiyonel: {target?: 'site'|'wordpress', channels?: ('site'|'newsletter'|'social')[]}
    // target varsayılan site. channels verilmezse GERİYE UYUM: site + otomatik sosyal.
    let target: 'site' | 'wordpress' = 'site';
    let channels: PublishChannel[] | undefined;
    try {
      const body = (await request.json()) as { target?: string; channels?: unknown } | null;
      if (body?.target === 'wordpress') target = 'wordpress';
      if (Array.isArray(body?.channels)) {
        const allowed: PublishChannel[] = ['site', 'newsletter', 'social'];
        const picked = body.channels.filter(
          (c): c is PublishChannel => typeof c === 'string' && (allowed as string[]).includes(c),
        );
        // Yalnızca geçerli değer(ler) geldiyse uygula; boş/çöp gelirse eski davranışa düş (undefined).
        if (picked.length > 0) channels = Array.from(new Set(picked));
      }
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

    // ─── Varsayılan yol: SİTE (canakkale.network) ───
    if (target === 'site') {
      const { article, updated } = await publishDraftToSite(
        draft,
        { sub: session?.sub, name: session?.name },
        channels ? { channels } : undefined,
      );
      const siteUrl = `https://canakkale.network/haber/${article.slug}`;
      await audit(session, 'published', 'aiDraft', draft.id, `AI taslağı siteye yayınlandı (${article.slug}): ${article.title}`);

      // 'newsletter' kanalı seçildiyse: gönderilmeye hazır bülten TASLAĞI oluştur
      // (insan sonra /newsletters'tan gönderir). Yayını asla bozmaz — best-effort.
      let newsletterId: string | null = null;
      if (channels?.includes('newsletter')) {
        try {
          const nl = await prisma.newsletter.create({
            data: {
              subject: article.title,
              content: `${article.title}\n\n${siteUrl}`,
              status: 'draft',
            },
          });
          newsletterId = nl.id;
          await audit(session, 'created', 'newsletter', nl.id, `AI haberinden bülten taslağı: ${article.title}`);
        } catch (e) {
          console.error('[publish] bülten taslağı oluşturulamadı', e);
        }
      }

      return NextResponse.json({
        ok: true,
        target: 'site',
        articleId: article.id,
        slug: article.slug,
        siteUrl,
        channels: channels ?? null,
        newsletterId,
        draft: updated,
      });
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
