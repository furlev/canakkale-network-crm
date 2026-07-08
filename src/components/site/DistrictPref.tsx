'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DISTRICTS } from '@/lib/districts';
import styles from './DistrictPref.module.css';

/**
 * "Benim İlçem" — ziyaretçinin ilçe tercihini localStorage('cn-district')'te tutan
 * hafif seçici. Saf istemci; foundation DISTRICTS'i kullanır (prisma'ya bağlı değil).
 *
 * Tercih değişince:
 *   • localStorage('cn-district') güncellenir (push aboneliği bunu okur → ilçe-hedefli),
 *   • window'a `cn:district` CustomEvent'i yayılır → { slug, name } (başka bileşenler dinleyebilir),
 *   • navigateOnChange verilmişse ilgili /ilce/[slug] sayfasına gidilir.
 *
 * KULLANIM (rapor):
 *   • Header'a: <DistrictPref /> — sağ üstte "Benim İlçem" seçici.
 *   • Anasayfaya: <DistrictPref navigateOnChange /> — seçince o ilçenin haberlerine götürür.
 *   Diğer bileşenler tercihi okumak için:
 *     const v = localStorage.getItem('cn-district');  // '' = Tümü
 *     window.addEventListener('cn:district', (e) => e.detail);  // { slug, name }
 */

const STORAGE_KEY = 'cn-district';

declare global {
  interface WindowEventMap {
    'cn:district': CustomEvent<{ slug: string; name: string }>;
  }
}

export default function DistrictPref({
  navigateOnChange = false,
  className,
}: {
  navigateOnChange?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setValue(stored);
    } catch { /* gizli mod */ }
  }, []);

  const onChange = (slug: string) => {
    setValue(slug);
    try {
      if (slug) localStorage.setItem(STORAGE_KEY, slug);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* gizli mod */ }

    const name = DISTRICTS.find((d) => d.slug === slug)?.name || '';
    try {
      window.dispatchEvent(new CustomEvent('cn:district', { detail: { slug, name } }));
    } catch { /* CustomEvent yoksa yoksay */ }

    if (navigateOnChange && slug) router.push(`/ilce/${slug}`);
  };

  return (
    <label className={`${styles.wrap} ${className || ''}`}>
      <span className={styles.icon} aria-hidden="true">📍</span>
      <span className={styles.label}>Benim İlçem</span>
      <select
        className={styles.select}
        aria-label="Benim ilçem"
        value={value}
        suppressHydrationWarning
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Tümü</option>
        {DISTRICTS.map((d) => (
          <option key={d.slug} value={d.slug}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}
