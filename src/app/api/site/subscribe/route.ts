import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';

/**
 * Bülten aboneliği (halka açık; proxy'de public + IP rate-limitli).
 * E-posta benzersizdir: mevcut abone tekrar kaydolursa status active'e çekilir.
 */

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi gir'),
});

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, subscribeSchema);

    const existing = await prisma.subscriber.findUnique({ where: { email: body.email } });
    if (existing && existing.status === 'active') {
      return NextResponse.json({ ok: true, message: 'Bu e-posta zaten bültenimize kayıtlı. 💌' });
    }

    await prisma.subscriber.upsert({
      where: { email: body.email },
      update: { status: 'active' },
      create: { email: body.email, source: 'website', status: 'active' },
    });

    return NextResponse.json({
      ok: true,
      message: 'Bültene abone oldun! Şehrin gündemi artık kutuna düşecek. 🎉',
    });
  } catch (error) {
    return handleApiError(error, 'Abonelik kaydedilemedi');
  }
}
