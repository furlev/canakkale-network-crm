import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';

/**
 * AI haber KAYNAK yönetimi (NewsSource CRUD) — panel: /ai-news/kaynaklar.
 * Yalnız ekip lideri/yönetici (B/A). Yayın/toplama akışına dokunmaz; sadece
 * kaynak kayıtlarını yönetir (generate-drafts bunları okuyup çeker).
 */

const SOURCE_TYPES = ['official', 'local', 'aggregator', 'social'] as const;

/** Ortak alan doğrulaması (create/update paylaşır). */
const sourceBase = {
  name: z.string().min(1, 'Ad zorunlu').max(200),
  feedUrl: z
    .string()
    .min(1, 'Feed adresi zorunlu')
    .max(1000)
    .refine((v) => /^https?:\/\//i.test(v.trim()), { message: 'Geçerli bir http(s) adresi girin' }),
  type: z.enum(['rss', 'google_news']).optional(),
  enabled: z.boolean().optional(),
  needsUA: z.boolean().optional(),
  trustScore: z.coerce.number().int().min(0).max(100).optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  district: z.string().max(80).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
};

const sourceCreate = z.object(sourceBase);

/** GET — tüm kaynakları listeler (sağlık alanları dahil). */
export async function GET() {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const sources = await prisma.newsSource.findMany({
      orderBy: [{ enabled: 'desc' }, { name: 'asc' }],
    });
    return NextResponse.json(sources);
  } catch (error) {
    return handleApiError(error, 'Kaynaklar alınamadı');
  }
}

/** POST — yeni kaynak ekler. */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const body = await parseBody(request, sourceCreate);

    const created = await prisma.newsSource.create({
      data: {
        name: body.name.trim(),
        feedUrl: body.feedUrl.trim(),
        type: body.type ?? 'rss',
        enabled: body.enabled ?? true,
        needsUA: body.needsUA ?? false,
        trustScore: body.trustScore ?? 50,
        sourceType: body.sourceType ?? 'local',
        district: body.district?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    await audit(session, 'created', 'newsSource', created.id, `Haber kaynağı eklendi: ${created.name}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Kaynak oluşturulamadı');
  }
}
