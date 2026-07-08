import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { getJoinForm } from '@/lib/site';
import { clientIp } from '@/lib/net';

/**
 * "Ekibimize Katıl" başvurusu (halka açık; proxy'de public + IP rate-limitli).
 * Ek savunmalar:
 *  - honeypot ("website") doluysa sahte başarı döndürülür (botu bilgilendirmeyiz)
 *  - aynı IP'den saatte en fazla 5 başvuru (module-level Map)
 *  - gövde boyutu + `data` anahtar sayısı sınırlı (bellek DoS'a karşı)
 *  - form şemasındaki zorunlu alanlar + select değerleri sunucuda doğrulanır
 */

const MAX_BODY_BYTES = 64 * 1024; // 64KB — başvuru formu için fazlasıyla yeterli
const MAX_DATA_KEYS = 40;

const joinSchema = z.object({
  name: z.string().trim().min(2, 'Ad Soyad en az 2 karakter olmalı').max(120),
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi gir'),
  phone: z.string().trim().max(32).optional(),
  data: z
    .record(z.string().max(64), z.union([z.string().max(4000), z.boolean()]))
    .refine(d => Object.keys(d).length <= MAX_DATA_KEYS, `En fazla ${MAX_DATA_KEYS} alan gönderilebilir`)
    .optional(),
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

export async function POST(request: Request) {
  try {
    // Gövde boyutu üst sınırı (bellek/CPU DoS'a karşı) — parse'tan önce.
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_BYTES) {
      throw new ApiError(413, 'Gönderilen veri çok büyük.');
    }

    const body = await parseBody(request, joinSchema);

    // Honeypot dolu → bot. Sahte başarı döndür, kayıt açma.
    if (body.website && body.website.trim() !== '') {
      return NextResponse.json({ ok: true, message: 'Başvurun alındı.' });
    }

    const ip = clientIp(request.headers);
    if (!allowIp(ip)) {
      throw new ApiError(429, 'Çok fazla başvuru denemesi yapıldı. Lütfen daha sonra tekrar dene.');
    }

    const form = await getJoinForm();
    if (!form.enabled) {
      throw new ApiError(403, 'Başvurular şu an kapalı.');
    }

    // Form şemasına göre sunucu tarafı doğrulama + allowlist temizliği.
    const data = body.data || {};
    const cleanData: Record<string, string | boolean> = {};
    for (const field of form.fields) {
      if (field.id === 'name' || field.id === 'email' || field.id === 'phone') {
        // name/email zod'da, phone aşağıda; bunlar `data` içine yazılmaz
        if (field.id === 'phone' && field.required && !body.phone) {
          throw new ApiError(400, `"${field.label}" alanı zorunlu.`);
        }
        continue;
      }
      const value = data[field.id];
      const isString = typeof value === 'string';
      const filled = field.type === 'checkbox' ? value === true : isString && value.trim() !== '';

      if (field.required && !filled) {
        throw new ApiError(400, `"${field.label}" alanı zorunlu.`);
      }
      // Select değeri yalnızca formdaki seçeneklerden olabilir (veri bütünlüğü).
      if (field.type === 'select' && isString && value.trim() !== '') {
        const options = Array.isArray(field.options) ? field.options : [];
        if (!options.includes(value)) {
          throw new ApiError(400, `"${field.label}" için geçersiz seçim.`);
        }
      }
      // Yalnızca bilinen alan id'lerini sakla (kütle-atama/DoS anahtarlarını düşür).
      if (value !== undefined) cleanData[field.id] = value;
    }

    await prisma.joinApplication.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        data: JSON.stringify(cleanData),
        status: 'new',
      },
    });

    return NextResponse.json({ ok: true, message: form.successMessage });
  } catch (error) {
    return handleApiError(error, 'Başvuru kaydedilemedi');
  }
}
