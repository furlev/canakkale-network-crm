import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';
import { safeEqual } from '@/lib/secure';
import { setPharmacy, trDateStr, dateOnly, districtName } from '@/lib/citydata';
import { normalizeDistrict } from '@/lib/districts';

export const maxDuration = 60;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const SCRAPE_URL = process.env.PHARMACY_SCRAPE_URL || 'https://www.canakkaleeo.org.tr/nobetci-eczaneler';

type ParsedPharmacy = {
  district: string;
  name: string;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  source: string;
};

// ── metin yardımcıları ──
function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** "02862631100" → "0286 263 11 00" (11 hane, 0 ile başlıyorsa). Aksi halde olduğu gibi. */
function formatPhone(digits: string | null): string | null {
  if (!digits) return null;
  const d = digits.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) {
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  }
  return digits;
}

/** İlçe başlık metnini kanonik görünen ada indirger; bilinmeyen ilçe (ör. Bozcaada) ham başlıkla kalır. */
function resolveDistrict(headingDistrict: string): string {
  const slug = normalizeDistrict(headingDistrict);
  if (slug) return districtName(slug) || headingDistrict;
  // Bilinmeyen ilçe: Türkçe başlığı düzgün yaz (ilk harf büyük)
  const t = headingDistrict.toLocaleLowerCase('tr-TR');
  return t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
}

/**
 * Çanakkale Eczacı Odası nöbetçi eczane sayfasını ayrıştırır.
 * Yapı: <h3 class="main-color">X NÖBETÇİ ECZANELER</h3> ... <h4><strong>Ad</strong></h4>
 * <p> fa-home {adres} <br> tel:{tel} ... maps?q={lat},{lng} </p>
 */
function parsePharmacyHtml(html: string): ParsedPharmacy[] {
  // 1) İlçe başlıklarının konumları
  const headers: { index: number; district: string }[] = [];
  const h3re = /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = h3re.exec(html))) {
    const text = decode(hm[1]);
    const m = text.match(/^(.*?)\s+N[ÖO]BET[ÇC]?[İI]?\s+ECZANE/i);
    if (m && m[1] && m[1].toLocaleUpperCase('tr-TR') !== 'BUGÜN') {
      headers.push({ index: hm.index, district: m[1].trim() });
    }
  }
  if (headers.length === 0) return [];

  const districtAt = (pos: number): string => {
    let cur = headers[0].district;
    for (const h of headers) {
      if (h.index <= pos) cur = h.district;
      else break;
    }
    return cur;
  };

  // 2) Eczane blokları (h4 adı + izleyen içerik)
  const out: ParsedPharmacy[] = [];
  const seen = new Set<string>();
  const blockRe = /<h4\b[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4\b|<h3\b|$)/gi;
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(html))) {
    const name = decode(bm[1]);
    if (!name || !/eczane/i.test(name)) continue;
    const body = bm[2];

    // adres: fa-home ikonundan sonra ilk <br>'e kadar
    let address: string | null = null;
    const am = body.match(/fa-home[\s\S]*?<\/i>([\s\S]*?)<br/i);
    if (am) address = decode(am[1]) || null;

    // telefon
    let phone: string | null = null;
    const pm = body.match(/tel:([0-9\s]+)/i);
    if (pm) phone = formatPhone(pm[1]);

    // harita + koordinat
    let mapsUrl: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;
    const mu = body.match(/href="(https?:\/\/[^"]*maps[^"]*)"/i);
    if (mu) mapsUrl = mu[1];
    const qm = body.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
    if (qm) {
      lat = parseFloat(qm[1]);
      lng = parseFloat(qm[2]);
      if (!Number.isFinite(lat)) lat = null;
      if (!Number.isFinite(lng)) lng = null;
    }

    const district = resolveDistrict(districtAt(bm.index));
    const key = `${district}||${name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ district, name, address, phone, lat, lng, mapsUrl, source: 'scrape' });
  }
  return out;
}

/** CollectAPI (opsiyonel, PHARMACY_API_KEY gerektirir). Başarısızsa boş döner → scrape'e düşülür. */
async function fetchFromApi(apiKey: string): Promise<ParsedPharmacy[]> {
  const res = await fetch('https://api.collectapi.com/health/dutyPharmacy?il=Çanakkale', {
    headers: { authorization: `apikey ${apiKey}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`CollectAPI HTTP ${res.status}`);
  const json = (await res.json()) as { success?: boolean; result?: unknown };
  const result = Array.isArray(json.result) ? json.result : [];
  const out: ParsedPharmacy[] = [];
  for (const raw of result) {
    const r = raw as { name?: string; dist?: string; address?: string; phone?: string; loc?: string };
    if (!r.name) continue;
    let lat: number | null = null;
    let lng: number | null = null;
    let mapsUrl: string | null = null;
    if (r.loc) {
      if (/^https?:\/\//i.test(r.loc)) mapsUrl = r.loc;
      const lm = r.loc.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
      if (lm) {
        lat = parseFloat(lm[1]);
        lng = parseFloat(lm[2]);
        if (!mapsUrl && lat != null && lng != null) mapsUrl = `https://maps.google.com/maps?q=${lat},${lng}`;
      }
    }
    out.push({
      district: resolveDistrict(r.dist || 'Merkez'),
      name: r.name.trim(),
      address: r.address ? r.address.trim() : null,
      phone: formatPhone(r.phone || null),
      lat,
      lng,
      mapsUrl,
      source: 'api',
    });
  }
  return out;
}

/**
 * Nöbetçi eczane cron'u. Erişim: `Authorization: Bearer <CRON_SECRET>`.
 * Birincil: PHARMACY_API_KEY varsa CollectAPI; başarısızsa Çanakkale Eczacı Odası sayfasını parse eder.
 * Sonuçları NobetciEczane tablosuna upsert eder (benzersiz: date+district+name).
 * Kaynak hiç yoksa HATA DEĞİL — boş geçer, durum Setting('pharmacy').lastError'a yazılır.
 */
export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || !safeEqual(bearer, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const dateStr = trDateStr();
  const date = dateOnly(dateStr);
  let entries: ParsedPharmacy[] = [];
  let source = 'none';
  let lastError: string | null = null;

  // 1) API (opsiyonel)
  const apiKey = process.env.PHARMACY_API_KEY;
  if (apiKey) {
    try {
      entries = await fetchFromApi(apiKey);
      if (entries.length > 0) source = 'api';
    } catch (e) {
      lastError = `API: ${e instanceof Error ? e.message : 'bilinmeyen hata'}`;
    }
  }

  // 2) Scrape fallback
  if (entries.length === 0) {
    try {
      const res = await fetch(SCRAPE_URL, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(20000),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Kaynak HTTP ${res.status}`);
      const html = await res.text();
      entries = parsePharmacyHtml(html);
      if (entries.length > 0) source = 'scrape';
      else lastError = (lastError ? lastError + ' · ' : '') + 'Scrape: eczane bulunamadı (sayfa yapısı değişmiş olabilir)';
    } catch (e) {
      lastError = (lastError ? lastError + ' · ' : '') + `Scrape: ${e instanceof Error ? e.message : 'bilinmeyen hata'}`;
    }
  }

  // 3) Upsert
  let upserted = 0;
  const upsertErrors: string[] = [];
  for (const p of entries) {
    try {
      await prisma.nobetciEczane.upsert({
        where: { date_district_name: { date, district: p.district, name: p.name } },
        update: {
          address: p.address,
          phone: p.phone,
          lat: p.lat,
          lng: p.lng,
          mapsUrl: p.mapsUrl,
          source: p.source,
        },
        create: {
          date,
          district: p.district,
          name: p.name,
          address: p.address,
          phone: p.phone,
          lat: p.lat,
          lng: p.lng,
          mapsUrl: p.mapsUrl,
          source: p.source,
        },
      });
      upserted++;
    } catch (e) {
      upsertErrors.push(`${p.name}: ${e instanceof Error ? e.message : 'yazılamadı'}`);
    }
  }
  if (upsertErrors.length) {
    lastError = (lastError ? lastError + ' · ' : '') + `Kayıt: ${upsertErrors.length} satır yazılamadı`;
  }

  // 4) Eski kayıt temizliği (14 günden eski) — tablo şişmesin
  try {
    await prisma.nobetciEczane.deleteMany({
      where: { date: { lt: dateOnly(trDateStr(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))) } },
    });
  } catch { /* temizlik kritik değil */ }

  // 5) Durum meta'sını yaz
  try {
    await setPharmacy({
      date: upserted > 0 ? dateStr : null,
      count: upserted,
      source,
      fetchedAt: new Date().toISOString(),
      lastError,
    });
  } catch { /* meta yazımı kritik değil */ }

  return NextResponse.json({ ok: true, source, upserted, date: dateStr, lastError: lastError || undefined });
}
