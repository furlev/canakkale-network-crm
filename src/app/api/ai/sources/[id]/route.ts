import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { fetchFeed } from '@/lib/newsfeed';

/**
 * Tek kaynak: GET (kayıt / ?test=1 ile canlı deneme), PUT (güncelle), DELETE (sil).
 * fetchFeed newsfeed.ts'ten SALT içe aktarılır — o dosya düzenlenmez.
 */

const SOURCE_TYPES = ['official', 'local', 'aggregator', 'social'] as const;

const sourceUpdate = z.object({
  name: z.string().min(1).max(200).optional(),
  feedUrl: z
    .string()
    .min(1)
    .max(1000)
    .refine((v) => /^https?:\/\//i.test(v.trim()), { message: 'Geçerli bir http(s) adresi girin' })
    .optional(),
  type: z.enum(['rss', 'google_news']).optional(),
  enabled: z.boolean().optional(),
  needsUA: z.boolean().optional(),
  trustScore: z.coerce.number().int().min(0).max(100).optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  district: z.string().max(80).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/**
 * GET — kaydı döndürür. `?test=1` verilirse feed'i CANLI çeker ve ilk 5 başlığı döndürür.
 * `?test=1&feedUrl=...&needsUA=1` ile kaydedilmemiş bir adresi de deneyebilirsiniz
 * (bu durumda sağlık alanları güncellenmez — yalnızca kayıtlı adres denenirse yazılır).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const { id } = await context.params;
    const url = new URL(request.url);
    const source = await prisma.newsSource.findUnique({ where: { id } });
    if (!source) throw new ApiError(404, 'Kaynak bulunamadı');

    if (url.searchParams.get('test') !== '1') {
      return NextResponse.json(source);
    }

    // ── Canlı test ──
    const overrideUrl = url.searchParams.get('feedUrl')?.trim();
    const overrideUA = url.searchParams.get('needsUA');
    const feedUrl = overrideUrl && /^https?:\/\//i.test(overrideUrl) ? overrideUrl : source.feedUrl;
    const needsUA = overrideUA !== null ? overrideUA === '1' : source.needsUA;
    const persist = !overrideUrl; // yalnızca kayıtlı adres test edilirse sağlığı yaz

    try {
      const items = await fetchFeed(feedUrl, needsUA);
      if (persist) {
        await prisma.newsSource.update({
          where: { id },
          data: { lastFetchedAt: new Date(), lastItemCount: items.length, lastError: null },
        });
      }
      return NextResponse.json({
        ok: true,
        count: items.length,
        items: items.slice(0, 5).map((it) => ({ title: it.title, link: it.link, pubDate: it.pubDate })),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Bilinmeyen hata';
      if (persist) {
        await prisma.newsSource.update({
          where: { id },
          data: { lastFetchedAt: new Date(), lastItemCount: 0, lastError: message.slice(0, 500) },
        });
      }
      // Test hatası akışı bozmasın: 200 + ok:false ile UI'da satır içi göster
      return NextResponse.json({ ok: false, error: message });
    }
  } catch (error) {
    return handleApiError(error, 'Kaynak alınamadı');
  }
}

/** PUT — alanları günceller (kısmi). */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const body = await parseBody(request, sourceUpdate);
    const { id } = await context.params;

    const updated = await prisma.newsSource.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.feedUrl !== undefined ? { feedUrl: body.feedUrl.trim() } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.needsUA !== undefined ? { needsUA: body.needsUA } : {}),
        ...(body.trustScore !== undefined ? { trustScore: body.trustScore } : {}),
        ...(body.sourceType !== undefined ? { sourceType: body.sourceType } : {}),
        ...(body.district !== undefined ? { district: body.district?.trim() || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
      },
    });

    await audit(session, 'updated', 'newsSource', id, `Haber kaynağı güncellendi: ${updated.name}`);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Kaynak güncellenemedi');
  }
}

/** DELETE — kaynağı siler (FeedItem.sourceId onDelete: SetNull → geçmiş öğeler korunur). */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const { id } = await context.params;
    const existing = await prisma.newsSource.findUnique({ where: { id }, select: { name: true } });
    await prisma.newsSource.delete({ where: { id } });

    await audit(session, 'deleted', 'newsSource', id, `Haber kaynağı silindi: ${existing?.name ?? id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Kaynak silinemedi');
  }
}
