/**
 * AI taslak kalite skoru — güven katmanı (P0).
 *
 * Editörün onay kuyruğunda taslakları hızlı önceliklendirebilmesi için tek bir 0-100
 * skor üretir. Saf/deterministik (AI/DB import etmez) → hem üretim hattı hem UI güvenle
 * çağırır. Girdiler opsiyonel/eksik olabilir; eksik sinyaller nötr sayılır.
 *
 * Ağırlıklar (toplam 100):
 *   - confidence (fact-check güveni 0-1)      → 40 puan
 *   - sourceCount (bağımsız kaynak sayısı)    → 25 puan (>=3 kaynakta tam)
 *   - fieldFullness (taslak alan doluluğu 0-1) → 20 puan
 *   - originalityScore (özgünlük 0-100)        → 15 puan (yoksa nötr ~%60)
 *   - hasContradiction (çelişki bayrağı)       → -20 ceza
 */

export type QualityInput = {
  /** fact-check güven skoru (0-1) */
  confidence?: number | null;
  /** doğrulayan bağımsız kaynak sayısı */
  sourceCount?: number | null;
  /** özgünlük skoru (0-100, yüksek = kopya riski düşük); yoksa nötr sayılır */
  originalityScore?: number | null;
  /** kaynaklar arası çelişki tespit edildi mi */
  hasContradiction?: boolean | null;
  /** taslağın dolu alan oranı (0-1) */
  fieldFullness?: number | null;
};

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * 0-100 arası taslak kalite skoru döndürür (tam sayıya yuvarlanmış).
 */
export function computeQualityScore(input: QualityInput): number {
  const confidence = clamp01(typeof input.confidence === 'number' ? input.confidence : 0);
  const sourceCount = Math.max(0, typeof input.sourceCount === 'number' ? input.sourceCount : 0);
  const fieldFullness = clamp01(typeof input.fieldFullness === 'number' ? input.fieldFullness : 0);
  // Özgünlük verilmemişse nötr varsay (0.6) — eksik sinyal cezalandırmaz.
  const originality = typeof input.originalityScore === 'number'
    ? clamp01(input.originalityScore / 100)
    : 0.6;

  const confPts = confidence * 40;
  const srcPts = Math.min(sourceCount, 3) / 3 * 25; // 3+ bağımsız kaynak → tam puan
  const fullPts = fieldFullness * 20;
  const origPts = originality * 15;
  const penalty = input.hasContradiction ? 20 : 0;

  const raw = confPts + srcPts + fullPts + origPts - penalty;
  return Math.round(Math.min(100, Math.max(0, raw)));
}
