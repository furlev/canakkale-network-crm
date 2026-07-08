import { NextResponse } from 'next/server';
import { z } from 'zod';
import webpush from 'web-push';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { safeEqual } from '@/lib/secure';
import { normalizeDistrict, districtName } from '@/lib/districts';

export const maxDuration = 60;

/**
 * İlçe-hedefli web push gönderimi (Bearer <CRON_SECRET>; /api/site/ altında olduğu
 * için proxy public'tir — rota kendini Bearer ile korur).
 *
 * Hedefleme:
 *  • district verilmişse → o ilçeyi seçenler + "tüm ilçeler" (district=null) diyenler.
 *  • district yoksa → tüm aboneler (genel duyuru).
 * Gönderim sonucu 404/410 dönen (süresi dolmuş / iptal) abonelikler temizlenir.
 */

const sendSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(300),
  url: z.string().max(500).optional().nullable(),
  district: z.string().optional().nullable(),
  icon: z.string().max(500).optional().nullable(),
  image: z.string().max(1000).optional().nullable(),
  tag: z.string().max(80).optional().nullable(),
});

export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || !safeEqual(bearer, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: 'VAPID anahtarları tanımlı değil' }, { status: 503 });
  }

  try {
    const body = await parseBody(request, sendSchema);
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:webmaster@canakkale.network',
      publicKey,
      privateKey
    );

    const target = normalizeDistrict(body.district);
    const where = target ? { OR: [{ district: target }, { district: null }] } : {};

    const subs = await prisma.pushSubscription.findMany({ where });
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0, pruned: 0, targeted: 0 });
    }

    const payload = JSON.stringify({
      title: body.title,
      body: body.body,
      url: body.url || '/',
      icon: body.icon || undefined,
      image: body.image || undefined,
      // Aynı ilçe/konu için tek bildirime katlansın (spam olmasın)
      tag: body.tag || (target ? `ilce-${target}` : 'genel'),
    });

    const staleEndpoints: string[] = [];
    let sent = 0;
    let failed = 0;

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
      )
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        const status = (r.reason as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) staleEndpoints.push(subs[i].endpoint);
      }
    }

    // Süresi dolmuş abonelikleri temizle (tablo şişmesin)
    let pruned = 0;
    if (staleEndpoints.length > 0) {
      const del = await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: staleEndpoints } } });
      pruned = del.count;
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      pruned,
      targeted: subs.length,
      district: target ? districtName(target) : null,
    });
  } catch (error) {
    return handleApiError(error, 'Bildirim gönderilemedi');
  }
}
