import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';
import { safeEqual } from '@/lib/secure';
import { setFerryMeta } from '@/lib/citydata';

export const maxDuration = 60;

/**
 * Feribot tarifesi cron'u — GESTAŞ sefer tarifeleri sayfasını (gdu.com.tr)
 * ayrıştırıp FerrySchedule tablosuna yazar. Erişim: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Kurallar (savunmacı senkron):
 *  • YALNIZ season='auto' işaretli satırlar cron yönetimindedir. Manuel satırlara
 *    (season != 'auto') ASLA dokunulmaz; manuel bir saatle çakışan otomatik satır yazılmaz.
 *  • Sayfa çekilemez veya bir hat ayrıştırılamazsa (HTML yapısı değişmiş olabilir)
 *    o hattın mevcut satırları AYNEN korunur; hata Setting('ferryMeta').lastError'a yazılır.
 *  • '*' işaretli seferler (kaynakta "Cuma, Cumartesi ve Pazar") days enum'undaki
 *    en yakın temsil olan 'haftasonu' ile kaydedilir.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const SOURCE_URL = process.env.FERRY_SOURCE_URL || 'https://www.gdu.com.tr/sefer-tarifeleri';

/** FerrySchedule.season alanında otomatik satır işareti (şema değişikliği gerekmedi). */
const AUTO_MARK = 'auto';

/** Bir hat bu sayıdan az sefere ayrışırsa şüpheli sayılır ve o hat atlanır (eski veri korunur). */
const MIN_TIMES = 3;

/** Bir rota segmentinin azami uzunluğu — sınır işareti kaçarsa taşmayı frenler. */
const SEGMENT_CAP = 12000;

/**
 * Sayfadaki rota başlıkları (kaynak HTML'de birebir geçen metinler) → kanonik rota adı.
 * Başlıklar değişirse ilgili hat sessizce atlanır; kalanlar çalışmaya devam eder.
 */
const MARKERS: { needle: string; route: string }[] = [
  { needle: 'ÇANAKKALE-ECEABAT', route: 'Çanakkale-Eceabat' },
  { needle: 'ÇANAKKALE-KİLİTBAHİR', route: 'Çanakkale-Kilitbahir' },
  { needle: 'ECEABAT-ÇANAKKALE', route: 'Eceabat-Çanakkale' },
  { needle: 'KİLİTBAHİR-ÇANAKKALE', route: 'Kilitbahir-Çanakkale' },
  { needle: 'LAPSEKİ - GELİBOLU', route: 'Lapseki-Gelibolu' },
  { needle: 'GELİBOLU - LAPSEKİ', route: 'Gelibolu-Lapseki' },
  { needle: "Kabatepe'den Hareket", route: 'Kabatepe-Gökçeada' },
  { needle: "Gökçeada'dan Hareket", route: 'Gökçeada-Kabatepe' },
  { needle: "Geyikli'den Hareket", route: 'Geyikli-Bozcaada' },
  { needle: "Bozcaada'dan Hareket", route: 'Bozcaada-Geyikli' },
];

/** Yalnız segment SONLANDIRICI işaretler (rota değil) — ör. Erdek bölgesi tablolarına taşmayı keser. */
const BOUNDARIES = ['ERDEK', 'Popüler Seferler'];

type ParsedTime = { time: string; days: string };
type ParsedRoute = { route: string; times: ParsedTime[] };

/** Etiketleri söker, sık HTML entity'lerini çözer, boşlukları normalleştirir. */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Rota eşleştirme anahtarı: yalnız harfler, TR küçük harf ("Çanakkale - Eceabat" ≈ "Çanakkale-Eceabat"). */
function routeKey(route: string): string {
  return route.toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü]/g, '');
}

/**
 * GESTAŞ tarife sayfasını ayrıştırır. Strateji: rota başlığından bir sonraki
 * başlığa/sınıra kadar olan HTML diliminde, içeriği SADECE saat olan <td>
 * hücrelerini toplar ('-' dolgu hücreleri ve serbest metin doğal olarak elenir).
 * Yapı değişirse sonuç boş/eksik döner — çağıran taraf eski veriyi korur.
 */
function parseGestasHtml(html: string): ParsedRoute[] {
  type Pos = { index: number; route: string | null };
  const positions: Pos[] = [];
  for (const { needle, route } of MARKERS) {
    let idx = html.indexOf(needle);
    while (idx !== -1) {
      positions.push({ index: idx, route });
      idx = html.indexOf(needle, idx + needle.length);
    }
  }
  for (const b of BOUNDARIES) {
    let idx = html.indexOf(b);
    while (idx !== -1) {
      positions.push({ index: idx, route: null });
      idx = html.indexOf(b, idx + b.length);
    }
  }
  positions.sort((a, b) => a.index - b.index);

  const out: ParsedRoute[] = [];
  const seenRoutes = new Set<string>();
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (!pos.route || seenRoutes.has(pos.route)) continue;
    seenRoutes.add(pos.route);

    const nextIdx = i + 1 < positions.length ? positions[i + 1].index : html.length;
    const seg = html.slice(pos.index, Math.min(nextIdx, pos.index + SEGMENT_CAP));

    const times: ParsedTime[] = [];
    const seenTimes = new Set<string>();
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let m: RegExpExecArray | null;
    while ((m = cellRe.exec(seg))) {
      const cell = stripTags(m[1]);
      // Hücre yalnız saatten oluşmalı (başında/sonunda '*' olabilir): "07:00", "*05:00"
      const t = /^(\*)?\s*(\d{1,2}):(\d{2})\s*(\*)?$/.exec(cell);
      if (!t) continue;
      const h = parseInt(t[2], 10);
      const min = parseInt(t[3], 10);
      if (h > 23 || min > 59) continue;
      const hhmm = `${String(h).padStart(2, '0')}:${t[3]}`;
      if (seenTimes.has(hhmm)) continue;
      seenTimes.add(hhmm);
      times.push({ time: hhmm, days: t[1] || t[4] ? 'haftasonu' : 'hergun' });
    }
    if (times.length > 0) out.push({ route: pos.route, times });
  }
  return out;
}

export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || !safeEqual(bearer, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    // 1) Kaynağı çek — başarısızsa mevcut veri aynen kalır, yalnız meta güncellenir.
    let html: string;
    try {
      const res = await fetch(SOURCE_URL, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(20000),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Kaynak HTTP ${res.status}`);
      html = await res.text();
    } catch (e) {
      const msg = `Çekim: ${e instanceof Error ? e.message : 'bilinmeyen hata'}`;
      try {
        await setFerryMeta({ fetchedAt: new Date().toISOString(), source: SOURCE_URL, routes: {}, lastError: msg });
      } catch { /* meta yazımı kritik değil */ }
      return NextResponse.json({ ok: false, error: msg });
    }

    // 2) Ayrıştır
    const parsed = parseGestasHtml(html);
    const parsedByRoute = new Map(parsed.map((p) => [p.route, p]));

    // 3) Hat hat senkronize et — yalnız season='auto' satırlar yönetilir.
    const allRows = await prisma.ferrySchedule.findMany();
    const written: Record<string, number> = {};
    const errors: string[] = [];
    const skipped: string[] = [];

    for (const { route } of MARKERS) {
      const pr = parsedByRoute.get(route);
      if (!pr || pr.times.length < MIN_TIMES) {
        // Ayrışmadı/şüpheli az veri → bu hattın mevcut satırlarına dokunma.
        skipped.push(route);
        continue;
      }

      try {
        const key = routeKey(route);
        const rows = allRows.filter((r) => routeKey(r.route) === key);
        const manualTimes = new Set(rows.filter((r) => r.season !== AUTO_MARK).map((r) => r.departTime));
        const autoRows = rows.filter((r) => r.season === AUTO_MARK);

        // Hedef: tarifedeki saatler, manuel girilmiş bir saatle çakışanlar hariç.
        const desired = new Map<string, string>();
        for (const t of pr.times) {
          if (!manualTimes.has(t.time)) desired.set(t.time, t.days);
        }

        // Mevcut otomatik satırlar: saat başına tek satır tut, tarifeden düşenleri sil.
        const byTime = new Map<string, (typeof autoRows)[number]>();
        const delIds: string[] = [];
        for (const r of autoRows) {
          if (!desired.has(r.departTime) || byTime.has(r.departTime)) delIds.push(r.id);
          else byTime.set(r.departTime, r);
        }
        if (delIds.length > 0) {
          await prisma.ferrySchedule.deleteMany({ where: { id: { in: delIds }, season: AUTO_MARK } });
        }

        // Eksikleri ekle, gün tipi değişenleri güncelle (active/operator admin tercihiyse korunur).
        for (const [time, days] of desired) {
          const cur = byTime.get(time);
          if (!cur) {
            await prisma.ferrySchedule.create({
              data: { route, departTime: time, days, operator: 'GESTAŞ', season: AUTO_MARK, active: true },
            });
          } else if (cur.days !== days) {
            await prisma.ferrySchedule.update({ where: { id: cur.id }, data: { days } });
          }
        }
        written[route] = desired.size;
      } catch (e) {
        errors.push(`${route}: ${e instanceof Error ? e.message : 'yazılamadı'}`);
      }
    }

    // 4) Durum meta'sını yaz
    let lastError: string | null = null;
    if (skipped.length === MARKERS.length) {
      lastError = 'Ayrıştırma başarısız — hiçbir hat bulunamadı (sayfa yapısı değişmiş olabilir); mevcut veri korundu';
    } else if (skipped.length > 0 || errors.length > 0) {
      const parts: string[] = [];
      if (skipped.length > 0) parts.push(`Atlanan hatlar (veri korundu): ${skipped.join(', ')}`);
      if (errors.length > 0) parts.push(`Yazım hataları: ${errors.join(' · ')}`);
      lastError = parts.join(' · ');
    }
    try {
      await setFerryMeta({
        fetchedAt: new Date().toISOString(),
        source: SOURCE_URL,
        routes: written,
        lastError,
      });
    } catch { /* meta yazımı kritik değil */ }

    return NextResponse.json({
      ok: true,
      routes: written,
      skipped: skipped.length > 0 ? skipped : undefined,
      lastError: lastError || undefined,
    });
  } catch (error) {
    return handleApiError(error, 'Feribot tarifesi güncellenemedi');
  }
}
