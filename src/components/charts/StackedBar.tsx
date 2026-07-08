'use client';

/**
 * <StackedBar> — yığılmış veya gruplanmış çubuk grafik (inline SVG).
 * Çok serili, hover tooltip, y-ızgara, tabular-nums, CSS değişken renkleri.
 */

import { useId, useMemo, useState } from 'react';
import { seriesColor, formatTr, formatCompact, niceTicks } from './types';

export interface StackedBarSeries {
  name: string;
  color?: string;
  values: number[];
}

export interface StackedBarProps {
  categories: string[];
  series: StackedBarSeries[];
  width?: number;
  height?: number;
  /** true: yığılmış (varsayılan), false: yan yana gruplanmış. */
  stacked?: boolean;
  formatValue?: (n: number) => string;
  formatAxis?: (n: number) => string;
  yTicks?: number;
  className?: string;
  ariaLabel?: string;
}

const PAD = { top: 14, right: 16, bottom: 28, left: 48 };

export function StackedBar({
  categories,
  series,
  width = 640,
  height = 260,
  stacked = true,
  formatValue = formatTr,
  formatAxis = formatCompact,
  yTicks = 4,
  className,
  ariaLabel,
}: StackedBarProps) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const n = categories.length;

  const { ticks, yMax } = useMemo(() => {
    let hi = 0;
    for (let i = 0; i < n; i++) {
      if (stacked) {
        hi = Math.max(hi, series.reduce((sum, s) => sum + (s.values[i] || 0), 0));
      } else {
        for (const s of series) hi = Math.max(hi, s.values[i] || 0);
      }
    }
    const t = niceTicks(0, hi, yTicks);
    return { ticks: t, yMax: t[t.length - 1] };
  }, [categories, series, stacked, yTicks, n]);

  if (n === 0 || series.length === 0) {
    return <div className={`chart-empty ${className || ''}`}>Gösterilecek veri yok.</div>;
  }

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const bandW = plotW / n;
  const groupW = bandW * 0.62;
  const groupX0 = (i: number) => PAD.left + i * bandW + (bandW - groupW) / 2;
  const yAt = (v: number) => PAD.top + plotH - (v / (yMax || 1)) * plotH;
  const hAt = (v: number) => (v / (yMax || 1)) * plotH;

  return (
    <div className={`chart-wrap ${className || ''}`} style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={ariaLabel || 'Çubuk grafik'}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Yatay ızgara + y tikleri */}
        {ticks.map((t, i) => {
          const y = yAt(t);
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={width - PAD.right} y2={y} stroke="var(--border-subtle)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" className="chart-axis-label" fill="var(--text-muted)">
                {formatAxis(t)}
              </text>
            </g>
          );
        })}

        {/* Çubuklar */}
        {categories.map((_, i) => {
          const isHover = hover === i;
          if (stacked) {
            let acc = 0;
            return (
              <g key={i} opacity={hover === null || isHover ? 1 : 0.55}>
                {series.map((s, si) => {
                  const v = s.values[i] || 0;
                  const y = yAt(acc + v);
                  const h = hAt(v);
                  acc += v;
                  return (
                    <rect
                      key={si}
                      x={groupX0(i)}
                      y={y}
                      width={groupW}
                      height={Math.max(0, h)}
                      fill={seriesColor(s.color, si)}
                      rx={2}
                    />
                  );
                })}
                <rect
                  x={PAD.left + i * bandW}
                  y={PAD.top}
                  width={bandW}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                />
              </g>
            );
          }
          // gruplanmış
          const barW = groupW / series.length;
          return (
            <g key={i} opacity={hover === null || isHover ? 1 : 0.55}>
              {series.map((s, si) => {
                const v = s.values[i] || 0;
                return (
                  <rect
                    key={si}
                    x={groupX0(i) + si * barW}
                    y={yAt(v)}
                    width={Math.max(0, barW - 2)}
                    height={Math.max(0, hAt(v))}
                    fill={seriesColor(s.color, si)}
                    rx={2}
                  />
                );
              })}
              <rect
                x={PAD.left + i * bandW}
                y={PAD.top}
                width={bandW}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              />
            </g>
          );
        })}

        {/* x etiketleri */}
        {categories.map((c, i) => (
          <text key={i} x={PAD.left + i * bandW + bandW / 2} y={height - 9} textAnchor="middle" className="chart-axis-label" fill="var(--text-muted)">
            {c}
          </text>
        ))}
      </svg>

      {hover !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${((PAD.left + hover * bandW + bandW / 2) / width) * 100}%`,
            top: '8%',
            transform: `translate(${hover > n * 0.6 ? '-100%' : '-50%'}, 0)`,
          }}
        >
          <div className="chart-tooltip-title">{categories[hover]}</div>
          {series.map((s, si) => (
            <div key={si} className="chart-tooltip-row">
              <span className="chart-tooltip-dot" style={{ background: seriesColor(s.color, si) }} />
              <span className="chart-tooltip-name">{s.name}</span>
              <span className="chart-tooltip-value">{formatValue(s.values[hover] || 0)}</span>
            </div>
          ))}
        </div>
      )}

      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s, si) => (
            <span key={si} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: seriesColor(s.color, si) }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
