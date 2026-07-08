import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';

/**
 * Bülten aboneliği (halka açık; proxy'de public + IP rate-limitli).
 *
 * KVKK/gizlilik gözetimi:
 *  - Her durumda AYNI nötr mesaj döner (e-posta enumeration'ı engellenir; kayıtlı
 *    olup olmadığı dışarıdan anlaşılamaz).
 *  - Bilinçli abonelikten çıkmış (unsubscribed) kayıt, üçüncü kişinin isteğiyle
 *    SESSİZCE yeniden aktifleştirilMEZ — opt-out kalıcıdır.
 * Not: Çift-onay (double opt-in) e-posta doğrulaması sonraki fazda eklenecek.
 */

const NEUTRAL_MESSAGE = 'Talebin alındı, teşekkürler! Şehrin gündemi kutuna düşecek. 💌';

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi gir'),
});

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, subscribeSchema);

    const existing = await prisma.subscriber.findUnique({
      where: { email: body.email },
      select: { status: true },
    });

    // Opt-out kalıcı: unsubscribed kaydı reaktive etme, ama durumu dışarı sızdırma.
    if (existing?.status === 'unsubscribed') {
      return NextResponse.json({ ok: true, message: NEUTRAL_MESSAGE });
    }

    // Yeni ya da aktif/pending → aktif tut. Nötr mesaj her ihtimalde aynı.
    await prisma.subscriber.upsert({
      where: { email: body.email },
      update: { status: 'active' },
      create: { email: body.email, source: 'website', status: 'active' },
    });

    return NextResponse.json({ ok: true, message: NEUTRAL_MESSAGE });
  } catch (error) {
    return handleApiError(error, 'Abonelik kaydedilemedi');
  }
}
