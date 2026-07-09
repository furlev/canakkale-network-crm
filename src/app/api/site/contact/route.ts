import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { clientIp } from '@/lib/net';
import { notify } from '@/lib/notify';

/**
 * Halka açık iletişim formu (#33). Proxy'de /api/site/* public + IP rate-limitli.
 * Ek savunmalar (join rotasıyla aynı desen):
 *  - honeypot ("website") doluysa sahte başarı döner (botu bilgilendirmeyiz)
 *  - aynı IP'den saatte en fazla 5 mesaj (module-level Map)
 *  - gövde boyutu üst sınırı (bellek DoS'a karşı)
 * Kayıt: CRM Lead (source 'Web İletişim'; email/notes ayrı alanlarda).
 */

const MAX_BODY_BYTES = 32 * 1024; // 32KB — iletişim mesajı için fazlasıyla yeterli

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Ad Soyad en az 2 karakter olmalı').max(120),
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi gir'),
  message: z.string().trim().min(5, 'Mesaj en az 5 karakter olmalı').max(4000),
  website: z.string().max(200).optional(), // honeypot
});

// ── IP başına saatlik limit ──
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function allowIp(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 2000) {
    for (const [key, times] of hits) {
      if (times.every(t => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_BYTES) {
      throw new ApiError(413, 'Gönderilen veri çok büyük.');
    }

    const body = await parseBody(request, contactSchema);

    // Honeypot dolu → bot. Sahte başarı döndür, kayıt açma.
    if (body.website && body.website.trim() !== '') {
      return NextResponse.json({ ok: true, message: 'Mesajın alındı. En kısa sürede döneriz.' });
    }

    const ip = clientIp(request.headers);
    if (!allowIp(ip)) {
      throw new ApiError(429, 'Çok fazla mesaj gönderildi. Lütfen daha sonra tekrar dene.');
    }

    const lead = await prisma.lead.create({
      data: {
        name: body.name,
        email: body.email,
        notes: body.message.slice(0, 4000),
        source: 'Web İletişim',
        status: 'new',
      },
    });

    await notify('lead', `Web iletişim mesajı: ${body.name}`, '/leads');

    // Nötr başarı mesajı (bilgi sızdırma yüzeyi yok).
    return NextResponse.json({ ok: true, id: lead.id, message: 'Mesajın alındı. En kısa sürede döneriz.' });
  } catch (error) {
    return handleApiError(error, 'Mesaj gönderilemedi');
  }
}
