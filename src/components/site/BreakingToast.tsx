'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import styles from './BreakingToast.module.css';

export type ToastItem = { id: string; slug: string; title: string };

const AUTO_DISMISS_MS = 7000;

/**
 * Ekran üstü kızıl "SON DAKİKA" bildirimi. Kuyruğun BAŞINDAKİ öğe gösterilir;
 * kapatılınca / süresi dolunca sıradaki gelir (birden çok haber gelirse kuyruk).
 * Tıklanınca habere gider. reduced-motion / düşük tier'da animasyonsuz sabit görünür.
 *
 * aria-live="assertive" bölge kalıcıdır; içerik eklendiğinde ekran okuyucu anons eder.
 */
export default function BreakingToast({
  queue,
  onDismiss,
  noMotion = false,
}: {
  queue: ToastItem[];
  onDismiss: (id: string) => void;
  noMotion?: boolean;
}) {
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => onDismiss(current.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [current, onDismiss]);

  return (
    <div className={styles.region} role="alert" aria-live="assertive" aria-atomic="true">
      {current && (
        <div key={current.id} className={`${styles.toast} ${noMotion ? styles.static : ''}`}>
          <span className={styles.badge}>
            <span className={styles.pulse} aria-hidden="true" />
            SON DAKİKA
          </span>
          <Link
            href={`/haber/${current.slug}`}
            className={styles.link}
            onClick={() => onDismiss(current.id)}
          >
            {current.title}
          </Link>
          <button
            type="button"
            className={styles.close}
            onClick={() => onDismiss(current.id)}
            aria-label="Bildirimi kapat"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
