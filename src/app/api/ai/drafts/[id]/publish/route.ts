import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { publishDraftToSite, type PublishChannel } from '@/lib/publish-draft';

/**
 * AI taslağını canakkale.network sitesine yayınlar (tek hedef — WordPress kaldırıldı).
 * Body opsiyonel: { channels?: ('site'|'newsletter'|'social')[] }.
 *  - channels verilmezse GERİYE UYUM: site + otomatik sosyal.
 *  - 'newsletter' seçilirse gönderilmeye hazır bir bülten taslağı da oluşturulur.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    // Body opsiyonel: { channels?: ('site'|'newsletter'|'social')[] }
    let channels: PublishChannel[] | undefined;
    try {
      const body = (await request.json()) as { channels?: unknown } | null;
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
    if (draft.status === 'published' && draft.articleId) {
      throw new ApiError(409, 'Bu taslak zaten sitede yayınlanmış');
    }
    if (draft.status === 'rejected') {
      throw new ApiError(409, 'Reddedilmiş taslak yayınlanamaz');
    }
    if (!draft.body || !draft.body.trim()) {
      throw new ApiError(400, 'Taslak gövdesi boş — yayınlanamaz');
    }

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
  } catch (error) {
    return handleApiError(error, 'Taslak yayınlanamadı');
  }
}
