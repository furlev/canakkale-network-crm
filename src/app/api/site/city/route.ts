import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api';
import { getMarket, getWeather, getTodayPharmacies, getPharmacy } from '@/lib/citydata';
import { normalizeDistrict } from '@/lib/districts';

export const dynamic = 'force-dynamic';

/**
 * ŞEHİR PANOSU — halka açık okuma ucu (proxy'de IP bazlı hız sınırlı, oturum gerekmez).
 * Piyasa + hava + bugünün nöbetçi eczanelerini tek yanıtta birleştirir; istemci polling için.
 * ?ilce=<slug|ad> ile hava ve eczane ilçeye göre filtrelenir.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ilceRaw = url.searchParams.get('ilce');
    const ilce = ilceRaw ? normalizeDistrict(ilceRaw) : null;

    const [market, weather, pharmacy, pharmacyMeta] = await Promise.all([
      getMarket(),
      getWeather(),
      getTodayPharmacies(ilce),
      getPharmacy(),
    ]);

    // İlçe filtresi: hava tahminini tek ilçeye indir
    let weatherOut = weather;
    if (weather && ilce) {
      const one = weather.districts.find((d) => d.slug === ilce);
      weatherOut = { fetchedAt: weather.fetchedAt, districts: one ? [one] : [] };
    }

    // Bayatlık: piyasa 30dk, hava 3s eşiği
    const now = Date.now();
    const ageMin = (iso?: string | null) => (iso ? (now - new Date(iso).getTime()) / 60000 : Infinity);
    const stale = {
      market: ageMin(market?.fetchedAt) > 30,
      weather: ageMin(weatherOut?.fetchedAt) > 180,
    };

    return NextResponse.json({
      market,
      weather: weatherOut,
      pharmacy: { date: pharmacy.date, entries: pharmacy.entries, meta: pharmacyMeta },
      ilce,
      stale,
      now: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, 'Şehir panosu verisi alınamadı');
  }
}
