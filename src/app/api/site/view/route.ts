import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { clientIp } from '@/lib/net';

/**
 * Halka açık görüntülenme sayacı (proxy'de public + IP rate-limitli).
 * Mevcut davranış KORUNUR: SiteArticle.views denormalize sayacı +1; haber
 * bulunamazsa sessizce ok:false (istemci tarafını kırmayız).
 *
 * EK: aynı istekte first-party bir ArticleEvent('view') satırı da yazılır
 * (best-effort). Bu insert ASLA sayaç yolunu kırmaz — hata yutulur.
 */

const viewSchema = z.object({
  slug: z.string().min(1).max(120),
  // Ziyaretçinin geldiği dış host (document.referrer'dan) — trafik kaynağı analizi için.
  referrerHost: z.string().trim().max(160).optional(),
  // A/B başlık varyantı işaretçisi (hangi başlıkla tıklandı) — opsiyonel, hafif sayaç.
  v: z.string().trim().max(40).optional(),
});

/** A/B başlık varyant tıklamasını hafif bir Setting sayacına işler (best-effort).
 *  Ağır şema değişikliği YOK: Setting('titleAbStats') → { [slug]: { [variant]: sayaç } }.
 *  Yarış koşulunda birkaç artış kaybolabilir (A/B sinyali için kabul edilebilir); asla fırlatmaz. */
async function bumpTitleVariant(slug: string, variant: string): Promise<void> {
  const v = variant.replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  if (!v) return;
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'titleAbStats' } });
    let stats: Record<string, Record<string, number>> = {};
    if (row) {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed && typeof parsed === 'object') stats = parsed as Record<string, Record<string, number>>;
      } catch { /* bozuk → sıfırdan */ }
    }
    const bucket = stats[slug] && typeof stats[slug] === 'object' ? stats[slug] : {};
    bucket[v] = (typeof bucket[v] === 'number' ? bucket[v] : 0) + 1;
    stats[slug] = bucket;
    // Şişmeyi sınırla: en fazla 500 slug tut (fazlasında eski anahtarları at)
    const keys = Object.keys(stats);
    if (keys.length > 500) {
      for (const k of keys.slice(0, keys.length - 500)) delete stats[k];
    }
    await prisma.setting.upsert({
      where: { key: 'titleAbStats' },
      create: { key: 'titleAbStats', value: JSON.stringify(stats) },
      update: { value: JSON.stringify(stats) },
    });
  } catch {
    /* A/B sayacı kritik değil — sessiz geç */
  }
}

/** Kaba cihaz sınıfı (User-Agent) — kişisel veri değil. */
function deviceType(ua: string): 'mobile' | 'tablet' | 'desktop' {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|kindle|(android(?!.*mobi))/.test(s)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini|windows phone/.test(s)) return 'mobile';
  return 'desktop';
}

/** KVKK-dostu anonim günlük oturum kovası (ham IP saklanmaz). */
function sessionHash(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256')
    .update(`${ip}|${ua}|${day}|${process.env.AUTH_SECRET || 'cn'}`)
    .digest('hex')
    .slice(0, 40);
}

/** Sadece hostname (site içi/boş ise null = doğrudan trafik). */
function cleanHost(input: string | undefined, selfHost: string): string | null {
  if (!input) return null;
  let h = input.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(h)) h = new URL(h).hostname;
  } catch {
    /* düz host */
  }
  h = h.replace(/^www\./, '').slice(0, 120);
  const self = selfHost.replace(/^www\./, '').split(':')[0];
  if (!h || h === self) return null;
  return /^[a-z0-9.-]+$/.test(h) ? h : null;
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, viewSchema);
    try {
      // views++ (denormalize) + haberin id/ilçesini geri al
      const article = await prisma.siteArticle.update({
        where: { slug: body.slug },
        data: { views: { increment: 1 } },
        select: { id: true, district: true },
      });

      // First-party 'view' olayı — best-effort; başarısız olsa da sayaç yolu ok:true kalır.
      const ip = clientIp(request.headers);
      const ua = request.headers.get('user-agent') || '';
      const selfHost = (request.headers.get('host') || 'canakkale.network').toLowerCase();
      await prisma.articleEvent
        .create({
          data: {
            articleId: article.id,
            slug: body.slug,
            type: 'view',
            referrerHost: cleanHost(body.referrerHost, selfHost),
            deviceType: deviceType(ua),
            district: article.district,
            sessionHash: sessionHash(ip, ua),
          },
        })
        .catch(() => {
          /* analitik kritik değil — sessiz geç */
        });

      // EK: Günlük görüntülenme kovası (ArticleViewDaily) — trend hesabı için.
      // SiteArticle.views denormalize sayacına DOKUNMAZ; bu ayrı, tarih bazlı toplamdır.
      // UTC gün sınırı (@db.Date ile uyumlu) + best-effort; hata trend içindir, yutulur.
      const now = new Date();
      const dayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      await prisma.articleViewDaily
        .upsert({
          where: { articleId_date: { articleId: article.id, date: dayUtc } },
          create: { articleId: article.id, date: dayUtc, count: 1 },
          update: { count: { increment: 1 } },
        })
        .catch(() => {
          /* trend sayacı kritik değil — sessiz geç */
        });

      // A/B başlık varyant tıklaması (body.v veya ?v=) — best-effort, sayaç yolunu kırmaz.
      const variant = body.v || new URL(request.url).searchParams.get('v') || '';
      if (variant) await bumpTitleVariant(body.slug, variant);

      return NextResponse.json({ ok: true });
    } catch {
      // Slug yok / silinmiş — sayaç kritik değil, sessizce geç
      return NextResponse.json({ ok: false });
    }
  } catch (error) {
    return handleApiError(error, 'Görüntülenme kaydedilemedi');
  }
}
