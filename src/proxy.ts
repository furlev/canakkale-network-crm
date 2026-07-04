import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { canAccessPath } from '@/lib/permissions';

/** Paths reachable without a session. Webhook/cron routes authenticate themselves via secrets. */
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth/login',
  '/api/webhooks/',
  '/api/cron/',
  '/api/ai/analyze-article', // WordPress eklentisi Bearer secret ile çağırır; rota kendini korur
  '/api/ai/generate-drafts', // cron Bearer CRON_SECRET ile çağırır; rota kendini korur
  '/api/admin/seed-sources', // Bearer CRON_SECRET/admin ile kaynak seed; rota kendini korur
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p));
}

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
