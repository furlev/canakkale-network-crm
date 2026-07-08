/**
 * AI kullanım & maliyet günlüğü (P1).
 *
 * Her AI çağrısını (fn + model + token/görsel + süre + başarı) `AiUsageLog`'a yazar ve
 * yaklaşık USD maliyeti hesaplar. `withUsage()` ai.ts'teki çağrıları sarar; loglama
 * FIRE-AND-FORGET'tir (asla AI akışını kesmez / hata fırlatmaz).
 *
 * Ayrıca günlük bütçe (`Setting('aiBudget')`) durumunu döndürür → generate-drafts
 * aşımda görseli atlar / erken döner.
 *
 * NOT: Fiyatlar TAHMİNİDİR (aşağıdaki tablo). Gerçek fatura sağlayıcı konsolundadır;
 * buradaki amaç maliyet TRENDİNİ ve dağılımını editöre göstermektir.
 */

import prisma from '@/lib/prisma';

/* ── Fiyatlandırma (tahmini, USD) ── */
type Pricing = { inPer1M: number; outPer1M: number };

/** 1M token başına giriş/çıkış USD. Bilinmeyen model → DEFAULT. */
const DEFAULT_PRICING: Pricing = { inPer1M: 0.3, outPer1M: 2.5 };
const PRICING_TABLE: { match: RegExp; p: Pricing }[] = [
  { match: /embedding|text-embedding/i, p: { inPer1M: 0.02, outPer1M: 0 } },
  { match: /flash-?lite|flash-?8b/i, p: { inPer1M: 0.1, outPer1M: 0.4 } },
  { match: /pro/i, p: { inPer1M: 1.25, outPer1M: 10 } },
  { match: /flash/i, p: { inPer1M: 0.3, outPer1M: 2.5 } },
];

/** Imagen (görsel) başına tahmini USD. */
const IMAGE_PRICE_USD = 0.03;

function resolvePricing(model: string): Pricing {
  for (const { match, p } of PRICING_TABLE) if (match.test(model)) return p;
  return DEFAULT_PRICING;
}

/** Model + token/görsel sayısından yaklaşık USD maliyet. Sinyal yoksa null. */
export function estimateCostUsd(
  model: string,
  inputTokens?: number | null,
  outputTokens?: number | null,
  images?: number | null,
): number | null {
  const p = resolvePricing(model);
  let cost = 0;
  let has = false;
  if (typeof inputTokens === 'number' && inputTokens > 0) { cost += (inputTokens / 1_000_000) * p.inPer1M; has = true; }
  if (typeof outputTokens === 'number' && outputTokens > 0) { cost += (outputTokens / 1_000_000) * p.outPer1M; has = true; }
  if (typeof images === 'number' && images > 0) { cost += images * IMAGE_PRICE_USD; has = true; }
  return has ? Number(cost.toFixed(6)) : null;
}

/* ── Loglama ── */
export type UsageEntry = {
  fn: string;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  images?: number | null;
  ms?: number | null;
  ok: boolean;
};

/** AiUsageLog'a bir satır yazar. HER ZAMAN sessiz: loglama hatası AI akışını bozmaz. */
export async function logUsage(e: UsageEntry): Promise<void> {
  try {
    const costUsd = estimateCostUsd(e.model, e.inputTokens, e.outputTokens, e.images);
    await prisma.aiUsageLog.create({
      data: {
        fn: e.fn,
        model: e.model,
        inputTokens: e.inputTokens ?? null,
        outputTokens: e.outputTokens ?? null,
        images: e.images ?? null,
        costUsd,
        ms: e.ms ?? null,
        ok: e.ok,
      },
    });
  } catch (err) {
    console.error('[ai-usage] logUsage başarısız (yoksayıldı)', err);
  }
}

/** @google/genai yanıtından okunabilen token metası (opsiyonel alanlar). */
type UsageMetaCarrier = {
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

/**
 * Bir AI çağrısını zamanlar, token'larını (varsa) okur, USD maliyetini hesaplayıp
 * `AiUsageLog`'a yazar ve çağrının sonucunu OLDUĞU GİBİ döndürür.
 *   - Başarıda ve hatada tek satır loglar (ok bayrağıyla). Hata yukarı fırlatılır.
 *   - `estInputChars`: token metası gelmeyen çağrılarda (embed) giriş token'ını
 *     karakter/4 ile tahmin eder.
 */
export async function withUsage<T>(
  fn: string,
  model: string,
  call: () => Promise<T>,
  opts: { images?: number; estInputChars?: number } = {},
): Promise<T> {
  const started = Date.now();
  let ok = false;
  let res: T | undefined;
  try {
    res = await call();
    ok = true;
    return res;
  } finally {
    const ms = Date.now() - started;
    const um = (res as UsageMetaCarrier | undefined)?.usageMetadata;
    let inputTokens = um?.promptTokenCount ?? null;
    const outputTokens = um?.candidatesTokenCount ?? null;
    if ((inputTokens == null || inputTokens === 0) && opts.estInputChars) {
      inputTokens = Math.ceil(opts.estInputChars / 4);
    }
    void logUsage({ fn, model, inputTokens, outputTokens, images: opts.images ?? null, ms, ok });
  }
}

/* ── Günlük bütçe (Setting('aiBudget')) ── */
export type AiBudget = { enabled: boolean; dailyUsd: number };

const BUDGET_DEFAULT: AiBudget = { enabled: false, dailyUsd: 5 };

/** Setting('aiBudget') → {enabled, dailyUsd}. Yoksa/bozuksa varsayılan (KAPALI). */
export async function getAiBudget(): Promise<AiBudget> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'aiBudget' } });
    if (!row) return BUDGET_DEFAULT;
    const p = JSON.parse(row.value) as Partial<AiBudget>;
    return {
      enabled: p.enabled === true,
      dailyUsd: typeof p.dailyUsd === 'number' && p.dailyUsd > 0 ? p.dailyUsd : BUDGET_DEFAULT.dailyUsd,
    };
  } catch {
    return BUDGET_DEFAULT;
  }
}

/** Bugünün (yerel gün başı) toplam tahmini AI maliyeti (USD). */
export async function getTodayUsageUsd(): Promise<number> {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const agg = await prisma.aiUsageLog.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: start } } });
    return agg._sum.costUsd ?? 0;
  } catch {
    return 0;
  }
}

export type BudgetStatus = AiBudget & { spentUsd: number; exceeded: boolean };

/** Bütçe + bugünkü harcama + aşım bayrağı. Hata-toleranslı (asla fırlatmaz). */
export async function budgetStatus(): Promise<BudgetStatus> {
  const budget = await getAiBudget();
  const spentUsd = await getTodayUsageUsd();
  return { ...budget, spentUsd, exceeded: budget.enabled && spentUsd >= budget.dailyUsd };
}
