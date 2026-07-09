import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { honeypotTriggered, submittedTooFast } from '@/lib/bot';
import { clientIp } from '@/lib/net';
import { signReaderSession, READER_SESSION_COOKIE, readerCookieOptions } from '@/lib/reader-auth';

/**
 * Okuyucu (site üyesi) kaydı — halka açık (proxy'de /api/site/* public + IP rate-limit).
 * Savunma: honeypot ("website") + zaman-tuzağı + IP başına saatlik kayıt limiti + zod.
 * Başarıda okuyucu doğrudan giriş yapmış olur (reader_session cookie). Okuyucu ASLA
 * panel yetkisi kazanmaz — cookie ve sır tamamen ayrıdır (bkz. src/lib/reader-auth.ts).
 */

const MAX_BODY_BYTES = 8 * 1024;

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta gir').max(160),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı').max(200),
  name: z.string().trim().min(2, 'Ad en az 2 karakter olmalı').max(80).optional(),
  website: z.string().max(200).optional(), // honeypot
  ts: z.coerce.number().optional(), // form render epoch ms (zaman-tuzağı)
});

// ── IP başına saatlik kayıt limiti ──
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

    const body = await parseBody(request, registerSchema);

    // Honeypot / zaman-tuzağı → bot. Sahte başarı döndür (botu bilgilendirme, kayıt açma).
    if (honeypotTriggered(body.website) || submittedTooFast(body.ts, 2000)) {
      return NextResponse.json({ ok: true, message: 'Hesabın hazır! Giriş yapabilirsin.' });
    }

    const ip = clientIp(request.headers);
    if (!allowIp(ip)) {
      throw new ApiError(429, 'Çok fazla kayıt denemesi. Lütfen daha sonra tekrar dene.');
    }

    const existing = await prisma.siteReader.findUnique({
      where: { email: body.email },
      select: { id: true, password: true },
    });
    // Zaten kayıtlı (şifreli hesap) → giriş yönlendir. (Okuyucu kaydı düşük-riskli;
    // net mesaj UX için tercih edilir, panel login gibi enumeration-katı değil.)
    if (existing?.password) {
      throw new ApiError(409, 'Bu e-posta ile zaten bir hesap var — giriş yapmayı dene.');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const confirmToken = randomBytes(24).toString('base64url'); // opsiyonel e-posta doğrulama için

    // Yalnız bültene kayıtlı (şifresiz) kayıt varsa onu tamamla; yoksa oluştur.
    const reader = existing
      ? await prisma.siteReader.update({
          where: { id: existing.id },
          data: { password: passwordHash, name: body.name ?? undefined, confirmToken },
          select: { id: true, email: true, name: true },
        })
      : await prisma.siteReader.create({
          data: {
            email: body.email,
            password: passwordHash,
            name: body.name ?? null,
            plan: 'free',
            confirmToken,
          },
          select: { id: true, email: true, name: true },
        });

    // Kayıt = giriş: reader_session set et.
    const token = await signReaderSession({ sub: reader.id, email: reader.email, name: reader.name || '' });
    const res = NextResponse.json({
      ok: true,
      message: 'Hesabın oluşturuldu, hoş geldin!',
      reader: { email: reader.email, name: reader.name, plan: 'free', isPremium: false },
    });
    res.cookies.set(READER_SESSION_COOKIE, token, readerCookieOptions);
    return res;
  } catch (error) {
    return handleApiError(error, 'Kayıt oluşturulamadı');
  }
}
