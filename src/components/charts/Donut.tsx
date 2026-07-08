'use client';

/**
 * <Donut> — SVG halka grafik, hover vurgulu, değerli lejant.
 * stroke-dasharray tabanlı; CSS değişken renkleri; tabular-nums.
 */

import { useState } from 'react';
import { seriesColor, formatTr } from './types';

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

export interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  formatValue?: (n: number) => string;
  centerLabel?: string;
  /** Merkez büyük değeri override et (varsayılan: toplam). */
  centerValue?: string | number;
  legend?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Donut({
  segments,
  size = 168,
  thickness = 26,
  formatValue = formatTr,
  centerLabel = 'Toplam',
  centerValue,
  legend = true,
  className,
  ariaLabel,
}: DonutProps) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;

  return (
    <div className={`chart-donut ${className || ''}`}>
      <div className="chart-donut-ring" style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={ariaLabel || 'Halka grafik'}>
          {/* Zemin halka */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
          {total > 0 &&
            segments.map((s, i) => {
              const frac = s.value / total;
              const len = frac * c;
              const dash = `${len} ${c - len}`;
              const dashOffset = -offset;
              offset += len;
              if (s.value === 0) return null;
              const active = hover === i;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={seriesColor(s.color, i)}
                  strokeWidth={active ? thickness + 4 : thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ transition: 'stroke-width 150ms ease', cursor: 'default' }}
                  opacity={hover === null || active ? 1 : 0.5}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                />
              );
            })}
        </svg>
        <div className="chart-donut-center">
          <span className="chart-donut-value">
            {hover !== null ? formatValue(segments[hover].value) : centerValue ?? formatValue(total)}
          </span>
          <span className="chart-donut-label">{hover !== null ? segments[hover].label : centerLabel}</span>
        </div>
      </div>

      {legend && (
        <div className="chart-donut-legend">
          {segments.map((s, i) => (
            <div
              key={i}
              className="chart-donut-legend-item"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              style={{ opacity: hover === null || hover === i ? 1 : 0.55 }}
            >
              <span className="chart-legend-dot" style={{ background: seriesColor(s.color, i) }} />
              <span className="chart-donut-legend-label">{s.label}</span>
              <span className="chart-donut-legend-value">{formatValue(s.value)}</span>
              <span className="chart-donut-legend-pct">
                {total > 0 ? `%${Math.round((s.value / total) * 100)}` : '%0'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
