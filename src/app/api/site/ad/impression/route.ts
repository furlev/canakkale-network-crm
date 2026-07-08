import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { clientIp } from '@/lib/net';

/**
 * Reklam gösterim beacon'ı (halka açık; AdSlot sunucu bileşeni içindeki inline
 * script `navigator.sendBeacon` ile çağırır).
 *
 * AdEvent('impression') + AdCampaign.impressions++ (atomik transaction).
 *
 * Şişirme koruması: aynı (anonim oturum + kampanya) çifti 30 dk içinde bir kez
 * sayılır. IP hash'lenerek saklanır (ham IP değil — KVKK). Kampanya yoksa/silinmişse
 * sessizce geçilir (istemci beacon'ı kırılmaz).
 */

const MAX_BODY_BYTES = 2 * 1024;
const schema = z.object({ campaignId: z.string().trim().min(1).max(64) });

// (oturum+kampanya) başına dedup penceresi
const DEDUP_MS = 30 * 60 * 1000;
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

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_BYTES) throw new ApiError(413, 'Gönderilen veri çok büyük.');

    const body = await parseBody(request, schema);

    const ip = clientIp(request.headers);
    const ua = request.headers.get('user-agent') || '';
    const day = new Date().toISOString().slice(0, 10);
    const session = shortHash(`${ip}|${ua}|${day}`);

    if (!firstInWindow(`${session}:${body.campaignId}`)) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    try {
      // AdEvent önce yazılır: kampanya yoksa FK ihlali → tüm transaction geri sarılır.
      await prisma.$transaction([
        prisma.adEvent.create({
          data: { campaignId: body.campaignId, type: 'impression', ipHash: shortHash(ip) },
        }),
        prisma.adCampaign.update({
          where: { id: body.campaignId },
          data: { impressions: { increment: 1 } },
        }),
      ]);
    } catch {
      // Kampanya bulunamadı / silinmiş → sessiz geç
      return NextResponse.json({ ok: false });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) return handleApiError(error, 'Gösterim kaydedilemedi');
    return NextResponse.json({ ok: false });
  }
}
