import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Bülten tık sarmalayıcı (halka açık). Gövdedeki site-içi bağlantılar buradan geçer:
 * `/api/site/nl/click/<token>?u=<hedef>`. Eşleşen NewsletterRecipient'e clickedAt
 * (ve gerekirse openedAt) damgalanır, ardından kullanıcı hedefe 302 ile gider.
 *
 * İlke: YÖNLENDİRME ASLA SAYAÇ YÜZÜNDEN BLOKLANMAZ.
 * Güvenlik (open-redirect'e karşı): hedef yalnız http(s) VE site host'larından biri
 * olabilir; aksi halde site ana sayfasına döner. Böylece token sızsa bile bu uç
 * bir açık yönlendirme (phishing) aracına dönüşemez.
 */

function siteHosts(): Set<string> {
  const set = new Set(
    (process.env.SITE_HOSTS || 'canakkale.network,www.canakkale.network')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean),
  );
  if (process.env.NODE_ENV !== 'production') {
    set.add('127.0.0.1:3000');
    set.add('127.0.0.1:3001');
    set.add('localhost:3000');
  }
  return set;
}

function publicBaseUrl(): string {
  const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://canakkale.network';
  return raw.replace(/\/+$/, '');
}

/** Yalnız http(s) + site host'u olan hedefi kabul eder; aksi halde null. */
function safeTarget(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return siteHosts().has(u.host.toLowerCase()) ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const home = publicBaseUrl() + '/';
  try {
    const { token } = await context.params;
    const target = safeTarget(new URL(request.url).searchParams.get('u')) || home;

    if (token) {
      await prisma.newsletterRecipient
        .updateMany({
          where: { token, clickedAt: null },
          data: { clickedAt: new Date(), openedAt: new Date() },
        })
        .catch(() => {});
    }

    return NextResponse.redirect(target, 302);
  } catch {
    return NextResponse.redirect(home, 302);
  }
}
