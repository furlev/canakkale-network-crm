import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api';
import { safeEqual } from '@/lib/secure';
import { parseTruncgilToday, setMarket } from '@/lib/citydata';

export const maxDuration = 30;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Piyasa cron'u — finans.truncgil.com/today.json (ÜCRETSİZ, key'siz) çekip
 * USD/EUR/gram+çeyrek altını `Setting('market')` JSON'una yazar.
 * Erişim: `Authorization: Bearer <CRON_SECRET>` (proxy /api/cron/* yolunu pas geçer, rota kendini korur).
 */
export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || !safeEqual(bearer, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const res = await fetch('https://finans.truncgil.com/today.json', {
      headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Kaynak yanıtı HTTP ${res.status}`);

    const json = (await res.json()) as Record<string, unknown>;
    const data = parseTruncgilToday(json);

    // En az bir kur çekilebildi mi? Hepsi boşsa kaynağı bozuk say, cache'i ezme.
    const hasAny = data.quotes.some((q) => q.selling != null || q.buying != null);
    if (!hasAny) {
      return NextResponse.json(
        { error: 'Piyasa kaynağı beklenen biçimde değil (tüm değerler boş)' },
        { status: 502 },
      );
    }

    await setMarket(data);
    return NextResponse.json({
      ok: true,
      updatedLabel: data.updatedLabel,
      quotes: data.quotes.map((q) => ({ code: q.code, selling: q.selling, changePct: q.changePct })),
    });
  } catch (error) {
    return handleApiError(error, 'Piyasa verisi güncellenemedi');
  }
}
