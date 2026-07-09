import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api';
import { safeEqual } from '@/lib/secure';
import { getEmergency, setEmergency, type EmergencyData } from '@/lib/citydata';

export const maxDuration = 30;

/**
 * ACİL DURUM / DEPREM MODU cron'u (A7b, #36).
 *
 * Kandilli/AFAD son depremler feed'ini (ücretsiz, key'siz public JSON) çeker ve
 * Çanakkale/Marmara bölgesinde eşik üstü (>=4.0) VEYA son 2 saatte büyük deprem
 * (>=5.0, ülke geneli) varsa `Setting('emergency')`'yi active:true yapar; yoksa
 * active:false. Erişim: `Authorization: Bearer <CRON_SECRET>` (safeEqual).
 *
 * GRACEFUL DEGRADATION: feed'e erişilemez / ayrıştırılamazsa mevcut acil durum
 * durumu DEĞİŞTİRİLMEZ (hata yutulur) — geçici ağ hatası yanlışlıkla bandı
 * kapatıp/açmasın. cron.yml entegratör tarafından eklenir (15 dk önerilir).
 */

// Kandilli "live" feed (topluluk API'si, ücretsiz). Erişilemezse AFAD'a düşer.
const KANDILLI_URL = 'https://api.orhanaydogdu.com.tr/deprem/kandilli/live?limit=50';
const AFAD_URL =
  'https://deprem.afad.gov.tr/apiv2/event/filter?start=' +
  encodeURIComponent(new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 19)) +
  '&orderby=timedesc&limit=50';

const FETCH_TIMEOUT = 12000;

// Marmara / Çanakkale bölgesi kaba sınırlayıcı kutu (enlem/boylam).
const MARMARA_BBOX = { latMin: 39.2, latMax: 41.6, lngMin: 25.5, lngMax: 30.8 };

// Bölge adı eşleşmesi (feed başlığı / en yakın şehir metni için).
const MARMARA_KEYWORDS = [
  'canakkale',
  'balikesir',
  'marmara',
  'tekirdag',
  'edirne',
  'kirklareli',
  'bursa',
  'istanbul',
  'kocaeli',
  'yalova',
  'sakarya',
  'saros',
  'gelibolu',
  'biga',
  'gokceada',
  'bozcaada',
  'ezine',
  'ayvacik',
  'eceabat',
  'lapseki',
  'bandirma',
  'erdek',
];

type Quake = {
  mag: number;
  region: string; // görünen yer adı
  lat: number | null;
  lng: number | null;
  depth: number | null;
  timeMs: number | null; // deprem anı (ms) — bilinmiyorsa null
};

/** Türkçe karakterleri sadeleştirir (bölge eşleşmesi için). */
function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function inMarmara(q: Quake): boolean {
  if (q.lat != null && q.lng != null) {
    if (
      q.lat >= MARMARA_BBOX.latMin &&
      q.lat <= MARMARA_BBOX.latMax &&
      q.lng >= MARMARA_BBOX.lngMin &&
      q.lng <= MARMARA_BBOX.lngMax
    ) {
      return true;
    }
  }
  const r = normalize(q.region);
  return MARMARA_KEYWORDS.some((k) => r.includes(k));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
    cache: 'no-store',
    headers: { 'User-Agent': 'canakkale-network-crm/1.0 (+https://canakkale.network)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** orhanaydogdu Kandilli "live" yanıtını Quake[]'e çevirir. */
function parseKandilli(json: unknown): Quake[] {
  const result = (json as { result?: unknown[] })?.result;
  if (!Array.isArray(result)) return [];
  const out: Quake[] = [];
  for (const rawItem of result) {
    const r = rawItem as {
      mag?: number;
      title?: string;
      depth?: number;
      date_time?: string;
      date?: string;
      geojson?: { coordinates?: number[] };
    };
    const mag = num(r.mag);
    if (mag == null) continue;
    const coords = Array.isArray(r.geojson?.coordinates) ? r.geojson!.coordinates! : [];
    const lng = num(coords[0]);
    const lat = num(coords[1]);
    // date_time genelde "YYYY-MM-DD HH:mm:ss" (TR yerel). ISO'ya çevir (+03:00).
    const dt = r.date_time || r.date || '';
    const iso = dt ? dt.replace(' ', 'T') + '+03:00' : '';
    const t = iso ? Date.parse(iso) : NaN;
    out.push({
      mag,
      region: String(r.title || '').trim(),
      lat,
      lng,
      depth: num(r.depth),
      timeMs: Number.isFinite(t) ? t : null,
    });
  }
  return out;
}

/** AFAD event/filter yanıtını Quake[]'e çevirir (yedek kaynak). */
function parseAfad(json: unknown): Quake[] {
  if (!Array.isArray(json)) return [];
  const out: Quake[] = [];
  for (const rawItem of json) {
    const r = rawItem as {
      magnitude?: string | number;
      location?: string;
      depth?: string | number;
      latitude?: string | number;
      longitude?: string | number;
      date?: string;
      eventDate?: string;
    };
    const mag = num(typeof r.magnitude === 'string' ? parseFloat(r.magnitude) : r.magnitude);
    if (mag == null) continue;
    const lat = num(typeof r.latitude === 'string' ? parseFloat(r.latitude) : r.latitude);
    const lng = num(typeof r.longitude === 'string' ? parseFloat(r.longitude) : r.longitude);
    const dt = r.eventDate || r.date || '';
    const iso = dt ? dt.replace(' ', 'T') + (dt.includes('+') || dt.endsWith('Z') ? '' : '+03:00') : '';
    const t = iso ? Date.parse(iso) : NaN;
    out.push({
      mag,
      region: String(r.location || '').trim(),
      lat,
      lng,
      depth: num(typeof r.depth === 'string' ? parseFloat(r.depth) : r.depth),
      timeMs: Number.isFinite(t) ? t : null,
    });
  }
  return out;
}

/** Feed'i çeker: önce Kandilli, hata olursa AFAD. İkisi de düşerse fırlatır. */
async function fetchQuakes(): Promise<Quake[]> {
  try {
    const j = await fetchJson<unknown>(KANDILLI_URL);
    const q = parseKandilli(j);
    if (q.length > 0) return q;
    throw new Error('Kandilli feed boş');
  } catch {
    const j = await fetchJson<unknown>(AFAD_URL);
    return parseAfad(j);
  }
}

const TWO_HOURS = 2 * 60 * 60 * 1000;
const REGION_THRESHOLD = 4.0; // Çanakkale/Marmara bölgesinde
const BIG_THRESHOLD = 5.0; // ülke geneli, son 2 saat

function severityFor(mag: number): EmergencyData['severity'] {
  if (mag >= 6.0) return 'critical';
  if (mag >= 5.0) return 'warning';
  return 'info';
}

/** Son 2 saatteki depremlerden tetikleyici olanı seçer (en büyük büyüklük). */
function pickTrigger(quakes: Quake[], nowMs: number): Quake | null {
  let best: Quake | null = null;
  for (const q of quakes) {
    // Zamanı bilinmiyorsa "yeni" varsay (feed zaten son depremleri döner).
    const recent = q.timeMs == null ? true : nowMs - q.timeMs <= TWO_HOURS;
    if (!recent) continue;
    const regional = inMarmara(q);
    const triggers = (regional && q.mag >= REGION_THRESHOLD) || q.mag >= BIG_THRESHOLD;
    if (!triggers) continue;
    if (!best || q.mag > best.mag) best = q;
  }
  return best;
}

function buildDetail(q: Quake): string {
  const parts: string[] = [];
  parts.push(`${q.mag.toFixed(1)} büyüklüğünde deprem`);
  if (q.region) parts.push(q.region);
  if (q.depth != null) parts.push(`derinlik ${q.depth.toFixed(0)} km`);
  return parts.join(' · ');
}

export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || !safeEqual(bearer, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  let quakes: Quake[];
  try {
    quakes = await fetchQuakes();
  } catch (error) {
    // GRACEFUL: feed erişilemedi → mevcut durumu DEĞİŞTİRME, hatayı yut.
    const current = await getEmergency().catch(() => null);
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: 'feed-unavailable',
      message: error instanceof Error ? error.message : 'bilinmeyen hata',
      active: current?.active ?? false,
    });
  }

  const now = Date.now();
  const trigger = pickTrigger(quakes, now);

  try {
    if (trigger) {
      const data: EmergencyData = {
        active: true,
        title: 'Deprem Uyarısı',
        detail: buildDetail(trigger),
        severity: severityFor(trigger.mag),
        updatedAt: new Date().toISOString(),
      };
      await setEmergency(data);
      return NextResponse.json({ ok: true, active: true, detail: data.detail, severity: data.severity });
    }

    // Tetikleyici yok → mevcut band açıksa kapat, zaten kapalıysa dokunma.
    const current = await getEmergency().catch(() => null);
    if (current?.active) {
      await setEmergency({
        active: false,
        title: '',
        detail: '',
        severity: 'info',
        updatedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json({ ok: true, active: false, scanned: quakes.length });
  } catch (error) {
    return handleApiError(error, 'Acil durum durumu güncellenemedi');
  }
}
