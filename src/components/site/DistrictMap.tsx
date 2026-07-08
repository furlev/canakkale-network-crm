'use client';

import Link from 'next/link';
import { DISTRICTS } from '@/lib/districts';
import styles from './DistrictMap.module.css';

/**
 * Çanakkale'nin 11 ilçesini gösteren basit, tıklanabilir kart ızgarası.
 * Gerçek harita koordinatı kullanmaz; her kart /ilce/[slug] hub'ına götürür.
 * `counts` verildiğinde ilçe başına haber sayısı rozeti gösterilir; `active`
 * o an görüntülenen ilçeyi vurgular. Hover'da yükselme + accent vurgu,
 * reduced-motion'da hareket kapalıdır.
 */
export default function DistrictMap({
  counts,
  active,
}: {
  counts?: Record<string, number>;
  active?: string;
}) {
  return (
    <div className={styles.map}>
      {/* Boğazı çağrıştıran soyut dekoratif şerit — yalnızca görsel */}
      <svg
        className={styles.motif}
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M0 70 C 70 40, 130 100, 200 78 S 340 40, 400 66 L400 200 L0 200 Z"
          fill="currentColor"
        />
        <path
          d="M0 108 C 90 84, 150 138, 230 116 S 360 92, 400 112"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>

      <nav className={styles.grid} aria-label="Çanakkale ilçeleri">
        {DISTRICTS.map((d) => {
          const n = counts?.[d.slug] ?? 0;
          const isActive = active === d.slug;
          return (
            <Link
              key={d.slug}
              href={`/ilce/${d.slug}`}
              className={`${styles.tile} ${isActive ? styles.tileActive : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.name}>{d.name}</span>
              <span className={styles.badge}>
                {n.toLocaleString('tr-TR')} haber
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
