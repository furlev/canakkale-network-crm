import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { audit } from '@/lib/audit';
import { getViewBoostSettings, displayViews, type ViewBoostSettings } from '@/lib/view-boost';

/**
 * Görüntülenme takviyesi GLOBAL ayarı — Setting('viewBoost').
 * Takviye yalnız SİTEDE gösterilen sayıyı etkiler; CRM analitiği gerçek views'i gösterir.
 * Hesap deterministiktir (src/lib/view-boost.ts) — cron yok, DB'ye sayaç yazılmaz.
 */

const viewBoostSettingsSchema = z
  .object({
    enabled: z.boolean(),
    dailyMin: z.number().int().min(0).max(1_000_000),
    dailyMax: z.number().int().min(0).max(1_000_000),
  })
  .refine(v => v.dailyMax >= v.dailyMin, {
    message: 'Günlük üst sınır alt sınırdan küçük olamaz',
    path: ['dailyMax'],
  });

/** Önizleme örneği: rastgele bir yayınlanmış haberin gerçek/takviyeli sayısı. */
type BoostSample = {
  id: string;
  title: string;
  realViews: number;
  boostedViews: number;
  publishedAt: Date | null;
} | null;

/**
 * Rastgele yayınlanmış bir haber seçer ve verilen ayarla takviyeli sayısını
 * hesaplar. Ayar kapalıyken de "açık olsaydı" değerini gösterir (enabled → true);
 * haberin kendi override'ı önizlemede DİKKATE ALINMAZ — amaç global aralığı görmek.
 */
async function randomPublishedSample(settings: ViewBoostSettings): Promise<BoostSample> {
  const where = { status: 'published', deletedAt: null, publishedAt: { not: null } } as const;
  const count = await prisma.siteArticle.count({ where });
  if (count === 0) return null;
  const skip = Math.floor(Math.random() * count);
  const article = await prisma.siteArticle.findFirst({
    where,
    orderBy: { publishedAt: 'desc' },
    skip,
    select: { id: true, title: true, views: true, publishedAt: true },
  });
  if (!article) return null;
  const boostedViews = displayViews(
    { id: article.id, publishedAt: article.publishedAt, views: article.views },
    { ...settings, enabled: true }
  );
  return {
    id: article.id,
    title: article.title,
    realViews: article.views,
    boostedViews,
    publishedAt: article.publishedAt,
  };
}

/** GET — mevcut ayar + örnek önizleme. */
export async function GET() {
  try {
    await requireLevel('B');
    const settings = await getViewBoostSettings();
    const sample = await randomPublishedSample(settings);
    return NextResponse.json({ settings, sample });
  } catch (error) {
    return handleApiError(error, 'Görüntülenme takviyesi ayarları alınamadı');
  }
}

/** PUT — ayarı doğrula, Setting('viewBoost') olarak kaydet, yeni örnekle dön. */
export async function PUT(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, viewBoostSettingsSchema);

    const value = JSON.stringify(body);
    await prisma.setting.upsert({
      where: { key: 'viewBoost' },
      update: { value },
      create: { key: 'viewBoost', value },
    });

    await audit(
      session,
      'updated',
      'setting',
      'viewBoost',
      `Görüntülenme takviyesi güncellendi: ${body.enabled ? 'açık' : 'kapalı'} (${body.dailyMin}-${body.dailyMax}/gün)`
    );
    const sample = await randomPublishedSample(body);
    return NextResponse.json({ settings: body, sample });
  } catch (error) {
    return handleApiError(error, 'Görüntülenme takviyesi kaydedilemedi');
  }
}
