import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { getJoinForm } from '@/lib/site';

/**
 * "Ekibimize Katıl" başvurusu (halka açık; proxy'de public + IP rate-limitli).
 * Ek savunmalar:
 *  - honeypot ("website") doluysa sahte başarı döndürülür (botu bilgilendirmeyiz)
 *  - aynı IP'den saatte en fazla 5 başvuru (module-level Map)
 *  - form şemasındaki zorunlu alanlar sunucuda da doğrulanır
 */

const joinSchema = z.object({
  name: z.string().trim().min(2, 'Ad Soyad en az 2 karakter olmalı').max(120),
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi gir'),
  phone: z.string().trim().max(32).optional(),
  data: z.record(z.string(), z.union([z.string().max(4000), z.boolean()])).optional(),
  website: z.string().max(200).optional(), // honeypot
});

// ── IP başına saatlik limit ──
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function allowIp(ip: string): boolean {
  const now = Date.now();
  // Map büyürse eski girdileri süpür
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

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, joinSchema);

    // Honeypot dolu → bot. Sahte başarı döndür, kayıt açma.
    if (body.website && body.website.trim() !== '') {
      return NextResponse.json({ ok: true, message: 'Başvurun alındı.' });
    }

    const ip = clientIp(request);
    if (!allowIp(ip)) {
      throw new ApiError(429, 'Çok fazla başvuru denemesi yapıldı. Lütfen daha sonra tekrar dene.');
    }

    const form = await getJoinForm();
    if (!form.enabled) {
      throw new ApiError(403, 'Başvurular şu an kapalı.');
    }

    // Şemadaki zorunlu alanları sunucuda da doğrula
    const data = body.data || {};
    for (const field of form.fields) {
      if (!field.required) continue;
      if (field.id === 'name' || field.id === 'email') continue; // zod hallediyor
      if (field.id === 'phone') {
        if (!body.phone) throw new ApiError(400, `"${field.label}" alanı zorunlu.`);
        continue;
      }
      const value = data[field.id];
      const filled =
        field.type === 'checkbox' ? value === true : typeof value === 'string' && value.trim() !== '';
      if (!filled) throw new ApiError(400, `"${field.label}" alanı zorunlu.`);
    }

    await prisma.joinApplication.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        data: JSON.stringify(data),
        status: 'new',
      },
    });

    return NextResponse.json({ ok: true, message: form.successMessage });
  } catch (error) {
    return handleApiError(error, 'Başvuru kaydedilemedi');
  }
}
