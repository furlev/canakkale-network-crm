import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api';
import { safeEqual } from '@/lib/secure';
import { fetchPrayer, setPrayer } from '@/lib/citydata';

export const maxDuration = 30;

/**
 * Namaz vakitleri cron'u — Aladhan API (city=Canakkale, country=Turkey,
 * method=13 = Diyanet İşleri Türkiye; ÜCRETSİZ, key'siz).
 * Çanakkale'nin günlük İmsak/Güneş/Öğle/İkindi/Akşam/Yatsı vakitlerini
 * `Setting('prayer')` JSON'una yazar. Günde bir kez çalışması yeterlidir.
 * Erişim: `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || !safeEqual(bearer, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const data = await fetchPrayer();
    await setPrayer(data);
    return NextResponse.json({ ok: true, date: data.date, timings: data.timings });
  } catch (error) {
    return handleApiError(error, 'Namaz vakitleri güncellenemedi');
  }
}
