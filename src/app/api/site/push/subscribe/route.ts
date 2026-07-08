import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { normalizeDistrict } from '@/lib/districts';

/**
 * Web push aboneliği (halka açık; proxy'de /api/site/ → public + IP rate-limitli).
 *
 * GET  → istemcinin abone olabilmesi için VAPID public key'i döner. Anahtar
 *        tanımlı değilse `{ enabled: false }` (özellik pasif; PushPrompt gizlenir).
 * POST → tarayıcı PushSubscription'ı (endpoint + keys) upsert eder. İlçe tercihi
 *        opsiyonel (ilçe-hedefli son dakika için). endpoint @unique olduğundan
 *        aynı cihaz tekrar abone olursa satır güncellenir (çoğaltma olmaz).
 */

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
  district: z.string().optional().nullable(),
});

export function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  return NextResponse.json({ enabled: !!publicKey, publicKey });
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, subscribeSchema);
    const district = normalizeDistrict(body.district);

    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      update: { p256dh: body.keys.p256dh, auth: body.keys.auth, district },
      create: { endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, district },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'Bildirim aboneliği kaydedilemedi');
  }
}

/** DELETE — aboneliği kaldır (kullanıcı bildirimleri kapatınca). */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'Abonelik kaldırılamadı');
  }
}
