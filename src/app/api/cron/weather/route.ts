import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api';
import { safeEqual } from '@/lib/secure';
import { fetchAllWeather, setWeather } from '@/lib/citydata';

export const maxDuration = 60; // 11 ilçe × (forecast + marine) çekimi

/**
 * Hava durumu cron'u — Open-Meteo forecast + marine (ÜCRETSİZ, key'siz).
 * 11 ilçenin bugün + 5 gün sıcaklık/yağış/rüzgâr ve (kıyı ilçelerde) deniz dalga
 * verisini çekip `Setting('weather')` JSON'una yazar.
 * Erişim: `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || !safeEqual(bearer, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const data = await fetchAllWeather();
    if (data.districts.length === 0) {
      return NextResponse.json(
        { error: 'Hiçbir ilçe için hava verisi alınamadı' },
        { status: 502 },
      );
    }

    await setWeather(data);
    return NextResponse.json({
      ok: true,
      districts: data.districts.length,
      coastal: data.districts.filter((d) => d.coastal).length,
    });
  } catch (error) {
    return handleApiError(error, 'Hava durumu verisi güncellenemedi');
  }
}
