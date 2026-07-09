import { NextResponse } from 'next/server';
import { READER_SESSION_COOKIE } from '@/lib/reader-auth';

/** Okuyucu çıkışı — reader_session cookie'sini siler. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(READER_SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
