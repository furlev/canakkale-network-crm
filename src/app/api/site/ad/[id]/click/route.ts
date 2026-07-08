import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { clientIp } from '@/lib/net';

/**
 * Reklam tıklama uç noktası (halka açık). AdSlot creative'i buraya link verir:
 * `/api/site/ad/<id>/click`. Kampanya bulunur, AdEvent('click') + clicks++ (throttle'lı)
 * yazılır ve kullanıcı hedef URL'e 302 ile yönlendirilir.
 *
 * İlke: SAYAÇ ASLA YÖNLENDİRMEYİ BLOKLAMAZ. Kampanya/hedef geçersizse ya da olay
 * kaydı düşerse bile kullanıcı akışı sürdürülür (kampanya yoksa siteye döner).
 *
 * Güvenlik: hedef yalnızca http(s) mutlak URL olabilir (javascript:/data: engellenir).
 * Reklam tıkı doğası gereği dış siteye gider (kasıtlı "open redirect" değil — hedef
 * kampanya tarafından yapılandırılır, kullanıcı girdisinden gelmez).
 */

// (oturum+kampanya) başına tıklama dedup penceresi
const DEDUP_MS = 10 * 60 * 1000;
const seen = new Map<string, number>();
function firstInWindow(key: string): boolean {
  const now = Date.now();
  if (seen.size > 20000) {
    for (const [k, t] of seen) if (now - t >= DEDUP_MS) seen.delete(k);
  }
  const last = seen.get(key);
  if (last && now - last < DEDUP_MS) return false;
  seen.set(key, now);
  return true;
}

function shortHash(s: string): string {
  return createHash('sha256').update(`${s}|${process.env.AUTH_SECRET || 'cn'}`).digest('hex').slice(0, 40);
}

/** Yalnızca http(s) mutlak URL'i kabul eder; aksi halde null. */
function safeTarget(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const home = new URL('/', request.url);
  try {
    const { id } = await context.params;

    const campaign = await prisma.adCampaign.findUnique({
      where: { id },
      select: { id: true, targetUrl: true, status: true },
    });
    const target = safeTarget(campaign?.targetUrl);
    if (!campaign || !target) {
      return NextResponse.redirect(home, 302);
    }

    // Olay kaydı — best-effort + throttle'lı; yönlendirmeyi asla bloklamaz.
    const ip = clientIp(request.headers);
    const ua = request.headers.get('user-agent') || '';
    const day = new Date().toISOString().slice(0, 10);
    const session = shortHash(`${ip}|${ua}|${day}`);
    if (firstInWindow(`${session}:${id}`)) {
      try {
        await prisma.$transaction([
          prisma.adEvent.create({ data: { campaignId: id, type: 'click', ipHash: shortHash(ip) } }),
          prisma.adCampaign.update({ where: { id }, data: { clicks: { increment: 1 } } }),
        ]);
      } catch {
        /* sayaç kritik değil — yönlendirmeye devam */
      }
    }

    return NextResponse.redirect(target, 302);
  } catch {
    // Beklenmeyen hata → kullanıcıyı boşta bırakma, siteye döndür
    return NextResponse.redirect(home, 302);
  }
}
