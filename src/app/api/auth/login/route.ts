import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { parseBody, handleApiError } from '@/lib/api';
import { loginSchema } from '@/lib/schemas';

/* Basit bellek-içi brute-force koruması: 5 hatalı deneme → 10 dk kilit.
   Not: çok-instance ortamda instance başına sayılır; tek free instance için yeterli. */
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; lockedUntil: number }>();

function attemptKey(request: Request, email: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  return `${ip}:${email.toLowerCase()}`;
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
        { status: 429 }
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

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Same error for unknown user / no password / wrong password — no user enumeration.
    const invalid = NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 });

    if (!user || !user.password) {
      registerFailure();
      return invalid;
    }
    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Hesabınız devre dışı bırakılmış' }, { status: 403 });
    }

    const ok = await bcrypt.compare(body.password, user.password);
    if (!ok) {
      registerFailure();
      return invalid;
    }
    attempts.delete(key);

    const token = await signSession({
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    const res = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (error) {
    return handleApiError(error, 'Giriş başarısız');
  }
}
