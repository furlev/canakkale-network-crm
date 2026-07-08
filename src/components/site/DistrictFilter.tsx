'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import styles from './DistrictFilter.module.css';

/** Hafif ilçe tipi — DISTRICTS'in alt kümesi (foundation'a bağımlı kalmaz). */
type DistrictLite = { slug: string; name: string };

const ALL_KEY = '__all';

/**
 * İlçe filtreleme şeridi (segmented pill). "Tümü" + 11 ilçe.
 * Aktif pilin ardında kaydıran bir accent gösterge oynar. URL ?ilce= ile
 * senkronize eder: tıklamada mevcut sorgu parametreleri korunur, yalnızca
 * `ilce` güncellenir ve `sayfa` sıfırlanır; navigasyon shallow (scroll:false).
 *
 * Aktif değer `active` prop'undan gelir (sunucu ?ilce'yi okuyup verir); tıklamada
 * anında yerel state güncellenip gösterge kayar, ardından sunucu yeniden filtreler.
 */
export default function DistrictFilter({
  districts,
  active = '',
  counts,
  total,
}: {
  districts: readonly DistrictLite[];
  active?: string;
  counts?: Record<string, number>;
  total?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [current, setCurrent] = useState(active);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  // Sunucu yeniden filtreleyip yeni `active` verdiğinde yerel state'i eşitle.
  useEffect(() => {
    setCurrent(active);
  }, [active]);

  const measure = useCallback(() => {
    const key = current || ALL_KEY;
    const el = btnRefs.current[key];
    if (!el) return;
    const left = el.offsetLeft;
    const width = el.offsetWidth;
    setIndicator((prev) =>
      prev.ready && prev.left === left && prev.width === width ? prev : { left, width, ready: true }
    );
  }, [current]);

  // Aktif pil değişince göstergeyi konumla (paint sonrası; gösterge opacity 0'dan yumuşar).
  useEffect(() => {
    measure();
  }, [measure]);

  // Şerit boyutu değişince (yeniden akış / responsive) göstergeyi yeniden ölç.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(track);
    return () => ro.disconnect();
  }, [measure]);

  const go = useCallback(
    (slug: string) => {
      setCurrent(slug);
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      if (slug) params.set('ilce', slug);
      else params.delete('ilce');
      params.delete('sayfa'); // filtre değişince sayfalamayı başa sar
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const items: { key: string; slug: string; label: string; count?: number }[] = [
    { key: ALL_KEY, slug: '', label: 'Tümü', count: total },
    ...districts.map((d) => ({ key: d.slug, slug: d.slug, label: d.name, count: counts?.[d.slug] })),
  ];

  return (
    <nav className={styles.wrap} aria-label="İlçe filtresi">
      <div className={styles.track} ref={trackRef} role="group">
        <span
          className={styles.indicator}
          aria-hidden="true"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: `${indicator.width}px`,
            opacity: indicator.ready ? 1 : 0,
          }}
        />
        {items.map((it) => {
          const isActive = (current || '') === it.slug;
          return (
            <button
              key={it.key}
              type="button"
              ref={(el) => {
                btnRefs.current[it.key] = el;
              }}
              className={`${styles.pill} ${isActive ? styles.pillActive : ''}`}
              aria-pressed={isActive}
              onClick={() => go(it.slug)}
            >
              <span>{it.label}</span>
              {typeof it.count === 'number' && (
                <span className={styles.count}>{it.count.toLocaleString('tr-TR')}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
