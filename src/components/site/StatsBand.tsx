'use client';

import { useEffect, useRef, useState } from 'react';
import useInViewOnce from './useInViewOnce';

export type StatItem = {
  label: string;
  value: number;
  /** Değer sonuna eklenecek ek ("+", "K" vb.) */
  suffix?: string;
  /** 'plain' → binlik ayraç yok (ör. kuruluş yılı 2024) */
  format?: 'plain';
};

/**
 * İnce istatistik bandı — görünür olduğunda sayılar count-up ile dolar.
 */
export default function StatsBand({ stats }: { stats: StatItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const started = useInViewOnce(ref); // IO + güvenlik ağı (rect süpürmesi)
  const [values, setValues] = useState<number[]>(() => stats.map(() => 0));

  useEffect(() => {
    if (!started) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValues(stats.map(s => s.value));
      return;
    }
    const DURATION = 1600;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / DURATION);
      const eased = 1 - Math.pow(1 - k, 3);
      setValues(stats.map(s => Math.round(s.value * eased)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // stats sunucudan bir kez gelir; started tetikleyicidir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  return (
    <div className="stats-band" ref={ref}>
      <div className="s-container">
        <dl className="stats-grid">
          {stats.map((s, i) => (
            <div className="stat" key={s.label}>
              <dd className="stat-value">
                {s.format === 'plain' ? String(values[i]) : values[i].toLocaleString('tr-TR')}
                {s.suffix && <span className="stat-suffix">{s.suffix}</span>}
              </dd>
              <dt className="stat-label">{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
