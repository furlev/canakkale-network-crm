import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { canAccessPath } from '@/lib/permissions';

/** Paths reachable without a session. Webhook/cron routes authenticate themselves via secrets. */
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth/login',
  '/api/health', // yük dengeleyici / izleme ping'i
  '/api/calendar/ics', // takvim aboneliği (HMAC imzalı kişisel token ile kendini korur)
  '/api/webhooks/',
  '/api/cron/',
  '/api/ai/analyze-article', // WordPress eklentisi Bearer secret ile çağırır; rota kendini korur
  '/api/ai/generate-drafts', // cron Bearer CRON_SECRET ile çağırır; rota kendini korur
  '/api/admin/seed-sources', // Bearer CRON_SECRET/admin ile kaynak seed; rota kendini korur
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p));
}

/**
 * Basit bellek-içi hız sınırlayıcı (instance başına). Oturumlu API isteklerini
 * kötüye kullanıma karşı frenler; limitler normal kullanımı etkilemeyecek kadar cömert.
 */
const rateBuckets = new Map<string, { n: number; reset: number }>();

function rateLimitOk(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (rateBuckets.size > 5000) {
    for (const [k, b] of rateBuckets) if (b.reset < now) rateBuckets.delete(k);
  }
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.reset < now) {
    rateBuckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.n >= limit) return false;
  bucket.n++;
  return true;
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  // Logged-in users don't need the login page
  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (isPublic(pathname)) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Oturumlu API istekleri için hız sınırı: yazma 120/dk, arama 30/dk (kullanıcı başına)
  if (pathname.startsWith('/api/')) {
    const tooMany =
      (MUTATION_METHODS.has(request.method) && !rateLimitOk(`w:${session.sub}`, 120, 60_000)) ||
      (pathname === '/api/search' && !rateLimitOk(`s:${session.sub}`, 30, 60_000));
    if (tooMany) {
      return NextResponse.json(
        { error: 'Çok fazla istek — lütfen biraz bekleyip tekrar deneyin' },
        { status: 429, headers: { 'Retry-After': '30' } }
      );
    }
  }

  // Rol bazlı sayfa erişimi (A/B/C). API rotaları kendi içinde yetki kontrolü yapar.
  if (!pathname.startsWith('/api/') && !canAccessPath(session, pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.json|sw\\.js).*)'],
};
