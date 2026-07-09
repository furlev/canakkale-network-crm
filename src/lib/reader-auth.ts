import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

/**
 * Okuyucu (site üyesi) oturumu — CRM panel auth'undan TAMAMEN ayrı.
 *
 * Neden ayrı: bir okuyucu ASLA panel yetkisi kazanmamalı. Bu yüzden:
 *  - ayrı cookie adı ('reader_session' — 'crm_session' değil),
 *  - ayrı imzalama sırrı (READER_AUTH_SECRET; yoksa AUTH_SECRET'e düşer),
 *  - proxy'de yalnızca /api/site/reader/* public prefix'i altında çözülür.
 * Panel proxy'si reader cookie'sini hiç tanımaz; okuyucu paneli göremez.
 */

export const READER_SESSION_COOKIE = 'reader_session';
const READER_SESSION_DURATION = 60 * 60 * 24 * 7; // 7 gün (saniye)

export type ReaderSession = {
  sub: string; // SiteReader.id
  email: string;
  name: string;
};

function getReaderSecret(): Uint8Array {
  // Ayrı sır; yoksa panel sırrına düşer ki tek env ile de çalışsın (graceful).
  const secret = process.env.READER_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('READER_AUTH_SECRET / AUTH_SECRET tanımlı değil');
  return new TextEncoder().encode(secret);
}

export async function signReaderSession(session: ReaderSession): Promise<string> {
  return new SignJWT({ email: session.email, name: session.name, kind: 'reader' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime(`${READER_SESSION_DURATION}s`)
    .sign(getReaderSecret());
}

export async function verifyReaderSession(token: string): Promise<ReaderSession | null> {
  try {
    const { payload } = await jwtVerify(token, getReaderSecret());
    // 'kind' alanı, panel token'ının yanlışlıkla reader olarak kabul edilmesini engeller.
    if (!payload.sub || payload.kind !== 'reader') return null;
    return {
      sub: payload.sub,
      email: (payload.email as string) || '',
      name: (payload.name as string) || '',
    };
  } catch {
    return null;
  }
}

/** Geçerli isteğin okuyucu oturumunu (yalnız JWT) döndürür. */
export async function getReaderSession(): Promise<ReaderSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(READER_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyReaderSession(token);
}

export const readerCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: READER_SESSION_DURATION,
};

/** Premium hâlâ geçerli mi? plan='premium' VE (premiumUntil boş=süresiz VEYA gelecekte). */
export function isPremiumActive(reader: { plan: string; premiumUntil: Date | null }): boolean {
  if (reader.plan !== 'premium') return false;
  if (!reader.premiumUntil) return true; // süresiz premium
  return reader.premiumUntil.getTime() > Date.now();
}

export type CurrentReader = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  premiumUntil: Date | null;
  isPremium: boolean;
};

/**
 * Oturumdaki okuyucuyu DB'den TAZE okur (plan/premiumUntil güncel olsun — panelden
 * 'Premium yap' yapıldığında yeniden giriş gerektirmez). Oturum yoksa/geçersizse null.
 * NOT: cookies() çağırdığı için yalnızca gerçekten gerektiğinde (ör. premium haber)
 * çağır; aksi hâlde sayfayı gereksiz yere dinamikleştirir.
 */
export async function getCurrentReader(): Promise<CurrentReader | null> {
  const session = await getReaderSession();
  if (!session) return null;
  try {
    const reader = await prisma.siteReader.findUnique({
      where: { id: session.sub },
      select: { id: true, email: true, name: true, plan: true, premiumUntil: true },
    });
    if (!reader) return null;
    return { ...reader, isPremium: isPremiumActive(reader) };
  } catch {
    return null;
  }
}
