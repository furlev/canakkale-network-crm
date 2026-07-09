import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'crm_session';
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

export type Session = {
  sub: string; // user id
  name: string;
  email: string;
  role: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(secret);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ name: session.name, email: session.email, role: session.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    // GÜVENLİK: site okuyucu (reader) token'ı panel oturumu OLARAK kabul edilmez.
    // reader-auth READER_AUTH_SECRET tanımsızsa AUTH_SECRET'e düşebildiğinden, kind
    // claim'i ile okuyucu token'ı reddedilir (yetki yükseltme savunması).
    if (payload.kind === 'reader') return null;
    return {
      sub: payload.sub,
      name: (payload.name as string) || '',
      email: (payload.email as string) || '',
      role: (payload.role as string) || 'user',
    };
  } catch {
    return null;
  }
}

/** Read the session of the current request (route handlers / server components). */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_DURATION,
};
