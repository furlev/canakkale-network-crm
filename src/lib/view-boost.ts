import prisma from '@/lib/prisma';

/**
 * Görüntülenme takviyesi — deterministik, cron'suz, DB'ye YAZMAYAN sanal sayaç.
 *
 * Sitede gösterilen görüntülenme sayısı = gerçek `SiteArticle.views` + takviye.
 * Takviye her okuyuşta aynı girdilerden yeniden HESAPLANIR (seed'li PRNG):
 *  - hiçbir cron/job yok, DB'ye hiçbir şey yazılmaz,
 *  - herkes aynı anda aynı sayıyı görür (fonksiyon saf/deterministik),
 *  - sayı zaman ilerledikçe ASLA azalmaz (gün içi kesir monoton, tam günler sabit).
 *
 * Kaynaklar:
 *  - Global ayar: Setting('viewBoost') → { enabled, dailyMin, dailyMax }.
 *  - Habere özel: SiteArticle.viewBoost (Json) → { mode: 'inherit'|'off'|'custom', dailyMin?, dailyMax? }.
 *
 * ÖNEMLİ: Takviye yalnız SİTEDE gösterilen sayıyı etkiler; CRM analitiği ve
 * panel listeleri gerçek `views` değerini göstermeye devam eder.
 *
 * NOT: Bu dosya prisma import ettiği için sunucuya bağlıdır — istemci bileşenler
 * buradan yalnız TİP alabilir (import type). Saf hesap fonksiyonlarının panel
 * önizlemesi için birebir kopyası site-yonetimi/haber/[id]/page.tsx içindedir
 * (slugifyTr ile aynı desen); algoritmayı değiştirirsen iki yeri birlikte güncelle.
 */

// ─── Tipler + varsayılanlar ───

/** Global takviye ayarı — Setting key: 'viewBoost'. */
export type ViewBoostSettings = { enabled: boolean; dailyMin: number; dailyMax: number };

/** Habere özel takviye yapılandırması — SiteArticle.viewBoost (Json). */
export type ArticleViewBoost = { mode: 'inherit' | 'off' | 'custom'; dailyMin?: number; dailyMax?: number };

export const DEFAULT_VIEW_BOOST_SETTINGS: ViewBoostSettings = { enabled: false, dailyMin: 40, dailyMax: 120 };

// ─── Seed'li PRNG (bağımlılıksız): xmur3 string hash + mulberry32 ───

/** xmur3 — string'i 32-bit tohuma indirger (deterministik). */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** mulberry32 — 32-bit tohumdan [0,1) üreten hızlı PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Verilen string seed için deterministik [0,1) değeri. */
function rnd01(seed: string): number {
  return mulberry32(xmur3(seed)())();
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

/** smoothstep — monoton [0,1]→[0,1] ease-in-out. */
function easeInOut(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

// ─── Yaş eğrisi: yeni haber hızlı, eski haber yavaş büyür (organik görünüm) ───

function ageCurve(d: number): number {
  if (d <= 1) return 1.6; // gün 0-1: taze haber patlaması
  if (d <= 3) return 1.25;
  if (d <= 7) return 1.0;
  if (d <= 14) return 0.6;
  if (d <= 30) return 0.3;
  return 0.12; // 30+ gün: uzun kuyruk
}

// ─── Gün içi akış eğrisi (TR saati, sabit UTC+3 — DST yok, deterministik) ───

/** Saat başına trafik ağırlığı: 00-07 arası yavaş, 09-23 arası hızlı. */
const HOUR_WEIGHTS = [
  0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, // 00-06: gece — çok yavaş
  0.5, 0.9,                          // 07-08: sabah rampası
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, // 09-15: gündüz — hızlı
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, // 16-22: akşam — hızlı
  1.0,                               // 23: gece yarısına iniş
];
const TOTAL_WEIGHT = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);

const TR_OFFSET_MS = 3 * 3_600_000; // Europe/Istanbul = sabit UTC+3
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Epoch ms → TR takvim günü numarası. */
function trDayNumber(t: number): number {
  return Math.floor((t + TR_OFFSET_MS) / DAY_MS);
}

/** Epoch ms → TR gün içi ms (0 ≤ x < 86,4M). */
function trMsOfDay(t: number): number {
  return (((t + TR_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
}

/** Gün içi ms → kümülatif saat ağırlığı (monoton artan). */
function cumWeight(msOfDay: number): number {
  const hour = Math.min(23, Math.floor(msOfDay / HOUR_MS));
  let acc = 0;
  for (let h = 0; h < hour; h++) acc += HOUR_WEIGHTS[h];
  acc += HOUR_WEIGHTS[hour] * ((msOfDay - hour * HOUR_MS) / HOUR_MS);
  return acc;
}

// ─── Çekirdek hesap ───

/** d günü için deterministik tam-sayı günlük artış (seed = articleId + ':' + d). */
function dailyIncrement(articleId: string, d: number, dailyMin: number, dailyMax: number): number {
  return Math.floor(lerp(dailyMin, dailyMax, rnd01(`${articleId}:${d}`)) * ageCurve(d));
}

/**
 * Yayın anından `now`'a birikmiş takviye (tam sayı, now ilerledikçe asla azalmaz).
 *  - Geçmiş TAM günler: günlük artışların toplamı.
 *  - İçinde bulunulan gün: günlük artış × gün içi monoton kesir (floor).
 *  - Yayın günü (gün 0): kesir yayın ANINDAN itibaren akar → yeni haber 0'dan başlar.
 */
export function computeViewBoost(
  articleId: string,
  publishedAt: Date | string | null | undefined,
  cfg: { dailyMin: number; dailyMax: number },
  now: Date = new Date()
): number {
  if (!publishedAt) return 0;
  const pub = typeof publishedAt === 'string' ? new Date(publishedAt) : publishedAt;
  const pubMs = pub.getTime();
  if (Number.isNaN(pubMs)) return 0;
  const nowMs = now.getTime();
  if (nowMs <= pubMs) return 0;

  // Aralığı normalize et: negatifleri sıfırla, ters aralığı düzelt
  let min = Math.max(0, Math.floor(cfg.dailyMin));
  let max = Math.max(0, Math.floor(cfg.dailyMax));
  if (max < min) [min, max] = [max, min];
  if (max === 0) return 0;

  const dNow = trDayNumber(nowMs) - trDayNumber(pubMs);

  // Geçmiş tam günler
  let total = 0;
  for (let d = 0; d < dNow; d++) total += dailyIncrement(articleId, d, min, max);

  // İçinde bulunulan gün: kısmi ilerleme (monoton kesir × günlük artış)
  const inc = dailyIncrement(articleId, dNow, min, max);
  const wNow = cumWeight(trMsOfDay(nowMs));
  let frac: number;
  if (dNow === 0) {
    // Yayın günü: kesir yayın anından gün sonuna normalize edilir → 0'dan başlar,
    // gün sonunda 1'e ulaşır (ertesi günkü tam artışla süreklidir).
    const wPub = cumWeight(trMsOfDay(pubMs));
    const denom = TOTAL_WEIGHT - wPub;
    frac = denom > 0 ? (wNow - wPub) / denom : 1;
  } else {
    frac = wNow / TOTAL_WEIGHT;
  }
  total += Math.floor(inc * easeInOut(frac));
  return total;
}

// ─── Yapılandırma çözümü ───

/** SiteArticle.viewBoost (Json/unknown) → doğrulanmış yapı; bozuksa null. */
export function parseArticleViewBoost(raw: unknown): ArticleViewBoost | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.mode !== 'inherit' && o.mode !== 'off' && o.mode !== 'custom') return null;
  const out: ArticleViewBoost = { mode: o.mode };
  if (typeof o.dailyMin === 'number' && Number.isFinite(o.dailyMin)) out.dailyMin = o.dailyMin;
  if (typeof o.dailyMax === 'number' && Number.isFinite(o.dailyMax)) out.dailyMax = o.dailyMax;
  return out;
}

/**
 * Etkin aralık çözümü:
 *  - mode 'off'            → takviye yok (null)
 *  - mode 'custom'         → haberin aralığı (eksik uç global değerden tamamlanır)
 *  - 'inherit' / tanımsız  → global enabled ise global aralık, değilse null
 */
export function resolveBoostRange(
  articleBoost: unknown,
  global: ViewBoostSettings
): { dailyMin: number; dailyMax: number } | null {
  const own = parseArticleViewBoost(articleBoost);
  if (own?.mode === 'off') return null;
  if (own?.mode === 'custom') {
    return { dailyMin: own.dailyMin ?? global.dailyMin, dailyMax: own.dailyMax ?? global.dailyMax };
  }
  return global.enabled ? { dailyMin: global.dailyMin, dailyMax: global.dailyMax } : null;
}

/** displayViews için gereken asgari haber alt kümesi. */
export type ViewBoostArticle = {
  id: string;
  publishedAt: Date | string | null;
  views: number;
  viewBoost?: unknown; // Prisma Json — verilmezse 'inherit' sayılır
};

/** Sitede gösterilecek sayı: gerçek views + (etkin yapılandırma varsa) takviye. */
export function displayViews(article: ViewBoostArticle, globalCfg: ViewBoostSettings, now: Date = new Date()): number {
  const range = resolveBoostRange(article.viewBoost ?? null, globalCfg);
  if (!range) return article.views;
  return article.views + computeViewBoost(article.id, article.publishedAt, range, now);
}

/**
 * Liste yardımcıcısı: satırların `views` alanını sitede gösterilecek takviyeli
 * değerle DEĞİŞTİRİR (yeni dizi döner; orijinali değişmez). Anasayfa/kategori/
 * arşiv gibi tüm public liste yüzeylerinde kullanılır ki haber detayıyla aynı
 * sayı görünsün (tutarsızlık denetim bulgusuydu). Sorgu select'ine `viewBoost`
 * eklemeyi unutma; yoksa habere özel override yerine yalnız global ayar uygulanır.
 */
export function withDisplayViews<T extends ViewBoostArticle>(
  rows: T[],
  globalCfg: ViewBoostSettings,
  now: Date = new Date()
): T[] {
  return rows.map(r => ({ ...r, views: displayViews(r, globalCfg, now) }));
}

// ─── Global ayar okuma (sunucu) ───

/** Setting('viewBoost') → doğrulanmış ayar; yoksa/bozuksa varsayılan (kapalı). */
export async function getViewBoostSettings(): Promise<ViewBoostSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'viewBoost' } });
    if (!row) return DEFAULT_VIEW_BOOST_SETTINGS;
    const parsed = JSON.parse(row.value) as Partial<ViewBoostSettings> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_VIEW_BOOST_SETTINGS;
    const num = (v: unknown, fallback: number): number =>
      typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;
    return {
      enabled: !!parsed.enabled,
      dailyMin: num(parsed.dailyMin, DEFAULT_VIEW_BOOST_SETTINGS.dailyMin),
      dailyMax: num(parsed.dailyMax, DEFAULT_VIEW_BOOST_SETTINGS.dailyMax),
    };
  } catch {
    return DEFAULT_VIEW_BOOST_SETTINGS;
  }
}
