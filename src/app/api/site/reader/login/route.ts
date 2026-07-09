import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { clientIp } from '@/lib/net';
import { signReaderSession, READER_SESSION_COOKIE, readerCookieOptions, isPremiumActive } from '@/lib/reader-auth';

/**
 * Okuyucu girişi — halka açık (proxy'de /api/site/* public + IP rate-limit).
 * Bcrypt compare → reader_session cookie. Panel login desenindeki gibi bellek-içi
 * brute-force kilidi (5 hata → 10 dk). Okuyucu ASLA panel yetkisi kazanmaz.
 */

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta gir').max(160),
  password: z.string().min(1, 'Şifre gerekli').max(200),
});

const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; lockedUntil: number }>();

function attemptKey(request: Request, email: string): string {
  return `${clientIp(request.headers)}:${email.toLowerCase()}`;
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, loginSchema);

    const key = attemptKey(request, body.email);
    const entry = attempts.get(key);
    if (entry && entry.lockedUntil > Date.now()) {
      const mins = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Çok fazla hatalı deneme. ${mins} dakika sonra tekrar deneyin.` },
        { status: 429 },
      );
    }

    const registerFailure = () => {
      const cur = attempts.get(key) || { count: 0, lockedUntil: 0 };
      cur.count += 1;
      if (cur.count >= MAX_ATTEMPTS) {
        cur.lockedUntil = Date.now() + LOCK_MS;
        cur.count = 0;
      }
      attempts.set(key, cur);
    };

    const reader = await prisma.siteReader.findUnique({ where: { email: body.email } });
    // Aynı hata (bilinmeyen kullanıcı / şifresiz / yanlış şifre) — enumeration'ı önler.
    const invalid = NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 });

    if (!reader || !reader.password) {
      registerFailure();
      return invalid;
    }

    const ok = await bcrypt.compare(body.password, reader.password);
    if (!ok) {
      registerFailure();
      return invalid;
    }
    attempts.delete(key);

    const token = await signReaderSession({ sub: reader.id, email: reader.email, name: reader.name || '' });
    const premium = isPremiumActive(reader);
    const res = NextResponse.json({
      ok: true,
      reader: { email: reader.email, name: reader.name, plan: reader.plan, isPremium: premium },
    });
    res.cookies.set(READER_SESSION_COOKIE, token, readerCookieOptions);
    return res;
  } catch (error) {
    return handleApiError(error, 'Giriş başarısız');
  }
}
