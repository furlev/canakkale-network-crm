import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { canAccessPath } from '@/lib/permissions';
import { clientIp } from '@/lib/net';

/** Paths reachable without a session. Webhook/cron routes authenticate themselves via secrets. */
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth/login',
  '/api/health', // yük dengeleyici / izleme ping'i
  '/api/calendar/ics', // takvim aboneliği (HMAC imzalı kişisel token ile kendini korur)
  '/api/webhooks/',
  '/api/cron/',
  '/api/ai/generate-drafts', // cron Bearer CRON_SECRET ile çağırır; rota kendini korur
  '/api/admin/seed-sources', // Bearer CRON_SECRET/admin ile kaynak seed; rota kendini korur
  '/site', // halka açık haber sitesi (canakkale.network)
  '/api/site/', // sitenin public API'leri (aşağıda IP bazlı hız sınırı)
];

/**
 * Haber sitesini sunan alan adları. Bu host'lardan gelen istekler /site/*
 * rotalarına rewrite edilir; panel yalnızca panel.canakkale.network'te kalır.
 * Yerelde 127.0.0.1:3000 site önizlemesidir (localhost:3000 = panel).
 */
const SITE_HOSTS = new Set(
  (process.env.SITE_HOSTS || 'canakkale.network,www.canakkale.network')
    .split(',')
    .map(h => h.trim())
    .filter(Boolean)
);
if (process.env.NODE_ENV !== 'production') {
  SITE_HOSTS.add('127.0.0.1:3000');
  SITE_HOSTS.add('127.0.0.1:3001');
}

/** Site host'unda kök yollara eşlenen özel dosya rotaları. */
const SITE_FILE_ROUTES = new Set(['/sitemap.xml', '/sitemap-news.xml', '/robots.txt', '/feed.xml', '/rss', '/feed']);

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

function tooManyResponse() {
  return NextResponse.json(
    { error: 'Çok fazla istek — lütfen biraz bekleyip tekrar deneyin' },
    { status: 429, headers: { 'Retry-After': '30' } }
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = (request.headers.get('host') || '').toLowerCase();

  // ── Public site API'leri (tüm host'larda): IP bazlı hız sınırı, oturum gerekmez ──
  if (pathname.startsWith('/api/site/')) {
    const ip = clientIp(request.headers);
    let limitOk: boolean;
    if (pathname === '/api/site/view' || pathname === '/api/site/event' || pathname === '/api/site/ad/impression') {
      // Görüntülenme/analitik/reklam-gösterim beacon'ları düşük-riskli ve sık; paylaşımlı
      // IP (CGNAT/kurumsal NAT) arkasındaki gerçek okuyucuları 429'lamamak için ayrı, cömert
      // kova (sunucu tarafı dedup zaten şişirmeyi engelliyor).
      limitOk = rateLimitOk(`pv:${ip}`, 400, 60_000);
    } else if (MUTATION_METHODS.has(request.method)) {
      limitOk = rateLimitOk(`pw:${ip}`, 30, 60_000); // abone/başvuru yazma
    } else {
      limitOk = rateLimitOk(`pr:${ip}`, 240, 60_000); // okuma
    }
    if (!limitOk) return tooManyResponse();
    return NextResponse.next();
  }

  // ── Haber sitesi host'u: her şeyi /site/* altına rewrite et ──
  if (SITE_HOSTS.has(host)) {
    // Panel API'leri site alan adında yok sayılır (bilgi sızdırma yüzeyini kapat)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }
    // Kök dosya rotaları (sitemap/robots/feed) → /site altındaki route handler'lara
    if (SITE_FILE_ROUTES.has(pathname)) {
      const target = pathname === '/rss' || pathname === '/feed' ? '/feed.xml' : pathname;
      const url = request.nextUrl.clone();
      url.pathname = `/site${target}`;
      return NextResponse.rewrite(url);
    }
    // İç içe route dosyaları (ör. /ilce/biga/feed.xml) statik değil → /site altına rewrite (query korunur)
    if (pathname.endsWith('/feed.xml') || pathname.endsWith('/sitemap.xml')) {
      const url = request.nextUrl.clone();
      url.pathname = `/site${pathname}`;
      return NextResponse.rewrite(url);
    }
    // Uzantılı yollar (public/ dosyaları: /site/logo-light.png, /site/brand.mp4...) olduğu gibi geçer
    if (/\.[a-zA-Z0-9]{2,5}$/.test(pathname)) {
      return NextResponse.next();
    }
    // /site/... ile doğrudan gelen SAYFA isteklerini kanonik köke yönlendir (query korunur)
    if (pathname === '/site' || pathname.startsWith('/site/')) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice('/site'.length) || '/';
      return NextResponse.redirect(url, 308);
    }
    // Sayfaları /site altına rewrite et — query string'i koruyarak
    const url = request.nextUrl.clone();
    url.pathname = `/site${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

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
    if (tooMany) return tooManyResponse();
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
