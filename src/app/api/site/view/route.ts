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
});

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

      return NextResponse.json({ ok: true });
    } catch {
      // Slug yok / silinmiş — sayaç kritik değil, sessizce geç
      return NextResponse.json({ ok: false });
    }
  } catch (error) {
    return handleApiError(error, 'Görüntülenme kaydedilemedi');
  }
}
