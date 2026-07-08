'use client';

/**
 * İskelet (skeleton) yükleme bileşenleri — ortak `.skeleton` sınıfları üzerine.
 * Sayfalardaki "Yükleniyor..." metin bloklarının yerine kullanılabilir.
 */

import type { CSSProperties } from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width, height = 14, radius, circle, className, style }: SkeletonProps) {
  return (
    <span
      className={`skeleton${circle ? ' skeleton-circle' : ''} ${className || ''}`}
      style={{
        display: 'block',
        width: width ?? '100%',
        height,
        borderRadius: circle ? '50%' : radius,
        ...style,
      }}
    />
  );
}

/** Birkaç satır metin iskeleti. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-text-group">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="skeleton-text" />
      ))}
    </div>
  );
}

/** Kart iskeleti (başlık + metin). */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card">
      <Skeleton width="45%" height={18} style={{ marginBottom: 'var(--space-4)' }} />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** İstatistik kartı ızgarası iskeleti. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="stats-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card">
          <Skeleton width={44} height={44} radius="var(--border-radius-md)" style={{ marginBottom: 'var(--space-4)' }} />
          <Skeleton width="60%" height={28} style={{ marginBottom: 'var(--space-2)' }} />
          <Skeleton width="40%" height={12} />
        </div>
      ))}
    </div>
  );
}

/** Tablo iskeleti — DataTable yüklenirken. */
export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table" aria-hidden>
      <div className="skeleton-table-head">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width="70%" height={12} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-table-row">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={c === 0 ? '55%' : '80%'} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
