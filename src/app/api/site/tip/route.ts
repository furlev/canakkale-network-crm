import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { clientIp } from '@/lib/net';
import { notify, nextNumber } from '@/lib/notify';
import { normalizeDistrict, districtName } from '@/lib/districts';

/**
 * Ziyaretçi haber ihbarı (halka açık; proxy'de public + IP rate-limitli).
 * join/route.ts savunma desenini izler:
 *  - honeypot ("website") doluysa sahte başarı döner (botu bilgilendirmeyiz)
 *  - aynı IP'den saatte en fazla 5 ihbar (module-level Map)
 *  - gövde boyutu üst sınırı (parse'tan önce)
 *
 * Kayıt: Tip.create({ source:'Web İhbar', sourceType:'web', status:'new' }).
 * İletişim bilgisi (opsiyonel) ihbar metninin altına iliştirilir — Tip'te ayrı
 * iletişim alanı yok, muhabir görebilsin diye.
 */

const MAX_BODY_BYTES = 16 * 1024;

const tipSchema = z.object({
  subject: z.string().trim().min(4, 'Konu en az 4 karakter olmalı').max(160),
  content: z.string().trim().min(10, 'İhbar detayı en az 10 karakter olmalı').max(6000),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().max(160).optional(),
  district: z.string().trim().max(40).optional(),
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
    if (contentLength > MAX_BODY_BYTES) throw new ApiError(413, 'Gönderilen veri çok büyük.');

    const body = await parseBody(request, tipSchema);

    // Honeypot dolu → bot. Sahte başarı döndür, kayıt açma.
    if (body.website && body.website.trim() !== '') {
      return NextResponse.json({ ok: true, message: 'İhbarın bize ulaştı. Teşekkür ederiz!' });
    }

    const ip = clientIp(request.headers);
    if (!allowIp(ip)) {
      throw new ApiError(429, 'Çok fazla ihbar gönderdin. Lütfen daha sonra tekrar dene.');
    }

    // İletişim + ilçe bilgisini metnin altına iliştir (Tip'te ayrı alan yok).
    const districtSlug = normalizeDistrict(body.district);
    const contactBits = [body.name, body.phone, body.email].map(v => v?.trim()).filter(Boolean).join(' · ');
    const footerLines = [
      districtSlug ? `İlçe: ${districtName(districtSlug)}` : '',
      contactBits ? `İletişim: ${contactBits}` : '',
    ].filter(Boolean);
    const content = footerLines.length ? `${body.content}\n\n— ${footerLines.join('\n')}` : body.content;

    const [last, count] = await Promise.all([
      prisma.tip.findFirst({ orderBy: { createdAt: 'desc' }, select: { tipNumber: true } }),
      prisma.tip.count(),
    ]);
    const tipNumber = nextNumber(last?.tipNumber, 'TIP', 3, count);

    const created = await prisma.tip.create({
      data: {
        tipNumber,
        subject: body.subject,
        content,
        source: 'Web İhbar',
        sourceType: 'web',
        priority: 'normal',
        status: 'new',
      },
    });

    await notify('tip', `Web ihbarı: ${created.subject}`, '/tips');
    return NextResponse.json({ ok: true, message: 'İhbarın bize ulaştı. Teşekkür ederiz!' });
  } catch (error) {
    return handleApiError(error, 'İhbar gönderilemedi');
  }
}
