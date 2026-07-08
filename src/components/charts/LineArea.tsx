'use client';

/**
 * <LineChart> / <AreaChart> — inline SVG, çok serili, hover tooltip'li.
 * Responsive: SVG %100 genişlik + auto yükseklik; tooltip yüzde konumlu.
 * Renkler CSS değişkeni; tabular-nums; light/dark otomatik.
 */

import { useId, useMemo, useState } from 'react';
import {
  type ChartSeries,
  seriesColor,
  formatTr,
  formatCompact,
  niceTicks,
} from './types';

export interface LineAreaProps {
  series: ChartSeries[];
  /** SVG mantıksal boyutu (görünüm oranını belirler). */
  width?: number;
  height?: number;
  /** Alan dolgusu (AreaChart için true). */
  area?: boolean;
  /** Tooltip / y-tik değer biçimi. */
  formatValue?: (n: number) => string;
  /** Eksen etiketi biçimi (varsayılan: kısa). */
  formatAxis?: (n: number) => string;
  formatX?: (x: string) => string;
  yTicks?: number;
  showDots?: boolean;
  className?: string;
  ariaLabel?: string;
}

const PAD = { top: 14, right: 16, bottom: 26, left: 48 };

function LineAreaChart({
  series,
  width = 640,
  height = 240,
  area = false,
  formatValue = formatTr,
  formatAxis = formatCompact,
  formatX = (x) => x,
  yTicks = 4,
  showDots = true,
  className,
  ariaLabel,
}: LineAreaProps) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const cleanSeries = series.filter((s) => s.points.length > 0);
  const n = cleanSeries[0]?.points.length ?? 0;

  const { ticks, yMin, yMax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of cleanSeries) {
      for (const p of s.points) {
        if (p.y < lo) lo = p.y;
        if (p.y > hi) hi = p.y;
      }
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    lo = Math.min(0, lo);
    const t = niceTicks(lo, hi, yTicks);
    return { ticks: t, yMin: t[0], yMax: t[t.length - 1] };
  }, [cleanSeries, yTicks]);

  if (n === 0) {
    return (
      <div className={`chart-empty ${className || ''}`}>Gösterilecek veri yok.</div>
    );
  }

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const span = yMax - yMin || 1;

  const xAt = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => PAD.top + plotH - ((v - yMin) / span) * plotH;

  const labels = cleanSeries[0].points.map((p) => p.x);
  // x etiketlerini seyrelt (fazla nokta varsa)
  const step = Math.max(1, Math.ceil(n / 12));

  return (
    <div className={`chart-wrap ${className || ''}`} style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={ariaLabel || 'Çizgi grafik'}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {cleanSeries.map((s, si) => (
            <linearGradient key={si} id={`${uid}-g${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor(s.color, si)} stopOpacity="0.28" />
              <stop offset="100%" stopColor={seriesColor(s.color, si)} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {/* Yatay ızgara + y tik etiketleri */}
        {ticks.map((t, i) => {
          const y = yAt(t);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={width - PAD.right}
                y2={y}
                stroke="var(--border-subtle)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={PAD.left - 8}
                y={y + 3}
                textAnchor="end"
                className="chart-axis-label"
                fill="var(--text-muted)"
              >
                {formatAxis(t)}
              </text>
            </g>
          );
        })}

        {/* Seriler */}
        {cleanSeries.map((s, si) => {
          const pts = s.points.map((p, i) => `${xAt(i)},${yAt(p.y)}`);
          const linePath = `M ${pts.join(' L ')}`;
          const col = seriesColor(s.color, si);
          const areaPath =
            `M ${xAt(0)},${yAt(yMin)} L ${pts.join(' L ')} L ${xAt(n - 1)},${yAt(yMin)} Z`;
          return (
            <g key={si}>
              {area && (
                <path d={areaPath} fill={`url(#${uid}-g${si})`} stroke="none" />
              )}
              <path
                d={linePath}
                fill="none"
                stroke={col}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {showDots &&
                s.points.map((p, i) => (
                  <circle
                    key={i}
                    cx={xAt(i)}
                    cy={yAt(p.y)}
                    r={hover === i ? 4.5 : n > 24 ? 0 : 2.5}
                    fill={col}
                    stroke="var(--bg-secondary)"
                    strokeWidth={hover === i ? 2 : 1}
                  />
                ))}
            </g>
          );
        })}

        {/* Hover dikey kılavuz */}
        {hover !== null && (
          <line
            x1={xAt(hover)}
            y1={PAD.top}
            x2={xAt(hover)}
            y2={PAD.top + plotH}
            stroke="var(--border-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* x etiketleri */}
        {labels.map((lab, i) =>
          i % step === 0 || i === n - 1 ? (
            <text
              key={i}
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              className="chart-axis-label"
              fill="var(--text-muted)"
            >
              {formatX(lab)}
            </text>
          ) : null,
        )}

        {/* Hover isabet bölgeleri */}
        {cleanSeries[0].points.map((_, i) => {
          const bw = plotW / Math.max(1, n - 1);
          return (
            <rect
              key={i}
              x={n === 1 ? PAD.left : xAt(i) - bw / 2}
              y={PAD.top}
              width={n === 1 ? plotW : bw}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            />
          );
        })}
      </svg>

      {/* Tooltip (yüzde konumlu → responsive) */}
      {hover !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(xAt(hover) / width) * 100}%`,
            top: `${(Math.min(...cleanSeries.map((s) => yAt(s.points[hover]?.y ?? yMin))) / height) * 100}%`,
            transform: `translate(${xAt(hover) > width * 0.6 ? '-100%' : '0'}, -100%)`,
          }}
        >
          <div className="chart-tooltip-title">{formatX(labels[hover])}</div>
          {cleanSeries.map((s, si) => (
            <div key={si} className="chart-tooltip-row">
              <span className="chart-tooltip-dot" style={{ background: seriesColor(s.color, si) }} />
              <span className="chart-tooltip-name">{s.name}</span>
              <span className="chart-tooltip-value">{formatValue(s.points[hover]?.y ?? 0)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lejant (birden çok seri) */}
      {cleanSeries.length > 1 && (
        <div className="chart-legend">
          {cleanSeries.map((s, si) => (
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

export function LineChart(props: LineAreaProps) {
  return <LineAreaChart {...props} area={false} />;
}

export function AreaChart(props: LineAreaProps) {
  return <LineAreaChart {...props} area />;
}
