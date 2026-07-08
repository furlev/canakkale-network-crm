import prisma from '@/lib/prisma';
import { DISTRICTS, districtName, normalizeDistrict } from '@/lib/districts';

/**
 * ŞEHİR PANOSU veri katmanı — Nöbetçi Eczane + Piyasa (döviz/altın) + Hava Durumu.
 *
 * İki tip depolama:
 *  • Piyasa ve Hava: değişken → `Setting` tablosunda JSON cache (key 'market' / 'weather').
 *    Cron rotaları yazar, public API + sayfalar okur. Kaynak API'ler ücretsiz/key'siz.
 *  • Nöbetçi Eczane: kalıcı → `NobetciEczane` tablosu (upsert). `Setting('pharmacy')` yalnızca
 *    çekim durumu/meta (son çekim, kaynak, hata) tutar.
 *
 * Bu modül prisma import ettiği için YALNIZCA sunucuda kullanılır. İstemci bileşenleri
 * buradan sadece `import type` ile tipleri alır (runtime import etmez).
 */

// ─────────────────────────────────────────────────────────────
// Tipler
// ─────────────────────────────────────────────────────────────

export type MarketQuote = {
  code: string; // 'USD' | 'EUR' | 'gram-altin' | 'ceyrek-altin'
  label: string; // 'Dolar', 'Euro', 'Gram Altın', 'Çeyrek Altın'
  buying: number | null;
  selling: number | null;
  changePct: number | null; // yüzde değişim (+/-)
};

export type MarketData = {
  updatedLabel: string | null; // kaynağın verdiği güncelleme metni (varsa)
  quotes: MarketQuote[]; // sabit sıra: USD, EUR, gram, çeyrek
  fetchedAt: string; // ISO — bizim çekim anımız
};

export type WeatherCurrent = {
  temp: number | null; // °C
  weatherCode: number | null; // WMO kodu
  windSpeed: number | null; // km/s
  precipitation: number | null; // mm
};

export type WeatherDay = {
  date: string; // YYYY-MM-DD
  weatherCode: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precipSum: number | null; // mm
  precipProb: number | null; // %
  windMax: number | null; // km/s
  waveMax: number | null; // deniz dalga yüksekliği (m) — iç ilçelerde null
};

export type DistrictForecast = {
  slug: string;
  name: string;
  current: WeatherCurrent;
  days: WeatherDay[]; // bugün + 5 gün
  coastal: boolean; // marine (deniz) verisi mevcut mu
};

export type WeatherData = {
  fetchedAt: string; // ISO
  districts: DistrictForecast[]; // DISTRICTS sırasıyla
};

export type PharmacyEntry = {
  district: string; // görünen ad (Merkez, Biga...)
  districtSlug: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
};

export type PharmacyMeta = {
  date: string | null; // temsil edilen gün YYYY-MM-DD
  count: number;
  source: string; // 'api' | 'scrape' | 'none'
  fetchedAt: string; // ISO
  lastError: string | null;
};

// ─────────────────────────────────────────────────────────────
// Setting JSON cache yardımcıları
// ─────────────────────────────────────────────────────────────

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (!row) return null;
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  const str = JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    update: { value: str },
    create: { key, value: str },
  });
}

export const getMarket = () => readJson<MarketData>('market');
export const setMarket = (d: MarketData) => writeJson('market', d);
export const getWeather = () => readJson<WeatherData>('weather');
export const setWeather = (d: WeatherData) => writeJson('weather', d);
export const getPharmacy = () => readJson<PharmacyMeta>('pharmacy');
export const setPharmacy = (d: PharmacyMeta) => writeJson('pharmacy', d);

// ─────────────────────────────────────────────────────────────
// Tarih yardımcıları (Türkiye sabit UTC+3, yaz saati yok)
// ─────────────────────────────────────────────────────────────

/** Europe/Istanbul takvim gününü YYYY-MM-DD verir. */
export function trDateStr(d: Date = new Date()): string {
  const tr = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return tr.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → Prisma @db.Date için UTC gece yarısı Date. */
export function dateOnly(str: string): Date {
  return new Date(`${str}T00:00:00.000Z`);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────
// Nöbetçi eczane okuma (NobetciEczane tablosu)
// ─────────────────────────────────────────────────────────────

function rowToEntry(r: {
  district: string;
  name: string;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  source: string;
}): PharmacyEntry {
  return {
    district: r.district,
    districtSlug: normalizeDistrict(r.district),
    name: r.name,
    address: r.address,
    phone: r.phone,
    mapsUrl: r.mapsUrl,
    lat: r.lat,
    lng: r.lng,
    source: r.source,
  };
}

/**
 * En güncel tarih grubundaki nöbetçi eczaneleri döner (gece yarısından sonra da
 * o günün nöbeti görünsün diye "en son tarih" mantığı). ?ilce ile filtrelenebilir.
 */
export async function getTodayPharmacies(
  ilce?: string | null,
): Promise<{ date: string | null; entries: PharmacyEntry[] }> {
  const latest = await prisma.nobetciEczane.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  if (!latest) return { date: null, entries: [] };

  const rows = await prisma.nobetciEczane.findMany({
    where: { date: latest.date },
    orderBy: [{ district: 'asc' }, { name: 'asc' }],
  });

  let entries = rows.map(rowToEntry);
  const slug = ilce ? normalizeDistrict(ilce) : null;
  if (slug) entries = entries.filter((e) => e.districtSlug === slug);

  return { date: toDateStr(latest.date), entries };
}

// ─────────────────────────────────────────────────────────────
// Piyasa (truncgil) ayrıştırma yardımcıları — sunucu tarafı
// ─────────────────────────────────────────────────────────────

/** Türkçe sayı metnini float'a çevirir: "6.138,12" → 6138.12 · "%-0,73" → -0.73 */
export function parseTrNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).replace('%', '').trim().replace(/\./g, '').replace(',', '.');
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

type TruncgilRow = { 'Alış'?: string; 'Satış'?: string; 'Değişim'?: string; 'Tür'?: string };

/**
 * finans.truncgil.com/today.json çıktısını MarketData'ya çevirir.
 * Kaynak Türkçe anahtar/alan kullanır: USD/EUR/gram-altin/ceyrek-altin → Alış/Satış/Değişim.
 */
export function parseTruncgilToday(json: Record<string, unknown>): MarketData {
  const pick = (key: string, label: string): MarketQuote => {
    const row = (json[key] || {}) as TruncgilRow;
    return {
      code: key,
      label,
      buying: parseTrNumber(row['Alış']),
      selling: parseTrNumber(row['Satış']),
      changePct: parseTrNumber(row['Değişim']),
    };
  };

  const meta = json['Meta_Data'] as { Update_Date?: string; Current_Update?: string } | undefined;
  const updatedLabel =
    (typeof json['Update_Date'] === 'string' ? (json['Update_Date'] as string) : null) ??
    meta?.Update_Date ??
    meta?.Current_Update ??
    null;

  return {
    updatedLabel,
    quotes: [
      pick('USD', 'Dolar'),
      pick('EUR', 'Euro'),
      pick('gram-altin', 'Gram Altın'),
      pick('ceyrek-altin', 'Çeyrek Altın'),
    ],
    fetchedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Hava durumu (Open-Meteo) çekme — sunucu tarafı
// ─────────────────────────────────────────────────────────────

const OM_TIMEOUT = 12000;

type OmForecast = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    precipitation?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
  };
};

type OmMarine = {
  daily?: { time?: string[]; wave_height_max?: number[] };
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(OM_TIMEOUT), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const num = (v: number | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Tek ilçe için Open-Meteo tahmini + (kıyı ise) deniz dalga verisini çeker. */
export async function fetchDistrictWeather(d: {
  slug: string;
  name: string;
  lat: number;
  lng: number;
}): Promise<DistrictForecast> {
  const fUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lng}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,precipitation` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=Europe%2FIstanbul&forecast_days=6`;

  const mUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${d.lat}&longitude=${d.lng}` +
    `&daily=wave_height_max&timezone=Europe%2FIstanbul&forecast_days=6`;

  const [fRes, mRes] = await Promise.allSettled([fetchJson<OmForecast>(fUrl), fetchJson<OmMarine>(mUrl)]);

  if (fRes.status !== 'fulfilled') {
    throw new Error(`${d.name}: hava tahmini alınamadı`);
  }
  const f = fRes.value;

  // Marine — iç ilçelerde veya API hatasında sessizce yok say
  let waves: number[] = [];
  let coastal = false;
  if (mRes.status === 'fulfilled') {
    const w = mRes.value.daily?.wave_height_max;
    if (Array.isArray(w) && w.some((x) => typeof x === 'number' && Number.isFinite(x))) {
      waves = w;
      coastal = true;
    }
  }

  const dl = f.daily || {};
  const times = dl.time || [];
  const days: WeatherDay[] = times.map((t, i) => ({
    date: t,
    weatherCode: num(dl.weather_code?.[i]),
    tempMax: num(dl.temperature_2m_max?.[i]),
    tempMin: num(dl.temperature_2m_min?.[i]),
    precipSum: num(dl.precipitation_sum?.[i]),
    precipProb: num(dl.precipitation_probability_max?.[i]),
    windMax: num(dl.wind_speed_10m_max?.[i]),
    waveMax: coastal ? num(waves[i]) : null,
  }));

  return {
    slug: d.slug,
    name: d.name,
    current: {
      temp: num(f.current?.temperature_2m),
      weatherCode: num(f.current?.weather_code),
      windSpeed: num(f.current?.wind_speed_10m),
      precipitation: num(f.current?.precipitation),
    },
    days,
    coastal,
  };
}

/** 11 ilçe için hava tahminini paralel çeker; tek ilçe hatası tüm çekimi bozmaz. */
export async function fetchAllWeather(): Promise<WeatherData> {
  const results = await Promise.allSettled(DISTRICTS.map((d) => fetchDistrictWeather(d)));
  const districts: DistrictForecast[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') districts.push(r.value);
  }
  return { fetchedAt: new Date().toISOString(), districts };
}

// Not: districtName re-export — tüketiciler tek yerden alsın diye.
export { districtName };
