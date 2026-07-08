/**
 * Grafik bileşenleri — paylaşılan tipler, renk paleti ve yardımcılar.
 * Harici bağımlılık YOK; her şey inline SVG + CSS değişkenleriyle çizilir.
 */

export type ChartPoint = { x: string; y: number };
export type ChartSeries = { name: string; color?: string; points: ChartPoint[] };

/** Kategorik seri paleti — tema değişkenlerine bağlı (light/dark otomatik). */
export const CHART_PALETTE: string[] = [
  'var(--primary)',
  'var(--accent)',
  'var(--success)',
  'var(--warning)',
  'var(--info)',
  'var(--error)',
  'var(--primary-light)',
  'var(--accent-light)',
];

/** i. seriye palet rengi ata (renk verilmemişse). */
export function seriesColor(explicit: string | undefined, index: number): string {
  return explicit || CHART_PALETTE[index % CHART_PALETTE.length];
}

/** Varsayılan Türkçe sayı biçimi. */
export function formatTr(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}

/** ₺ önekli para biçimi. */
export function formatTry(n: number): string {
  return `₺${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
}

/** Kısa sayı biçimi (eksen etiketleri için): 1.2K / 3,4M. */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${(n / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}K`;
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}

/** [min,max] aralığı için "güzel" eksen tikleri üretir. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    // Tek değer: 0..max ölçeği
    max = max === 0 ? 1 : max;
    min = Math.min(0, max);
  }
  const span = max - min;
  const rawStep = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}
