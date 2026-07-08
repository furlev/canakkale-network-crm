'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PrayerData } from '@/lib/citydata';
import styles from './PrayerCountdown.module.css';

/**
 * Namaz vakitleri kartı + sıradaki vakit geri sayımı.
 *
 * Vakitler "HH:MM" (Europe/Istanbul) olarak sunucudan gelir. Geri sayım, ziyaretçi
 * cihazının YEREL saatine göre hesaplanır (hedef kitle Çanakkale — TR yerel saati
 * varsayılır). Tüm bugünkü vakitler geçtiyse sıradaki vakit ertesi günün İmsak'ıdır.
 */

const ORDER: { key: keyof PrayerData['timings']; label: string; icon: string }[] = [
  { key: 'imsak', label: 'İmsak', icon: '🌙' },
  { key: 'gunes', label: 'Güneş', icon: '🌅' },
  { key: 'ogle', label: 'Öğle', icon: '☀️' },
  { key: 'ikindi', label: 'İkindi', icon: '🌤️' },
  { key: 'aksam', label: 'Akşam', icon: '🌇' },
  { key: 'yatsi', label: 'Yatsı', icon: '🌌' },
];

/** "HH:MM" → bugüne göre dakika (00:00'dan itibaren). Geçersizse null. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function PrayerCountdown({ data }: { data: PrayerData }) {
  const [now, setNow] = useState<Date | null>(null);

  // Saniyede bir tik — yalnızca istemcide (hydration sonrası) çalışır
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(
    () =>
      ORDER.map((o) => ({ ...o, time: data.timings[o.key] || '', minutes: toMinutes(data.timings[o.key] || '') })),
    [data.timings]
  );

  // Sıradaki vakit + geri sayım (yalnızca now hazırsa)
  const state = useMemo(() => {
    if (!now) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const valid = rows.filter((r) => r.minutes !== null);
    if (valid.length === 0) return null;

    let nextIdx = valid.findIndex((r) => (r.minutes as number) > nowMin);
    let rollsOver = false;
    if (nextIdx === -1) {
      nextIdx = 0; // hepsi geçti → ertesi gün İmsak
      rollsOver = true;
    }
    const next = valid[nextIdx];
    // Şu an içinde bulunulan vakit: sıradakinden bir önceki
    const currentKey =
      nextIdx === 0 ? valid[valid.length - 1].key : valid[nextIdx - 1].key;

    const targetMin = (next.minutes as number) + (rollsOver ? 24 * 60 : 0);
    const diffSec = Math.max(0, Math.round((targetMin - nowMin) * 60));
    const hh = Math.floor(diffSec / 3600);
    const mm = Math.floor((diffSec % 3600) / 60);
    const ss = diffSec % 60;

    return { nextKey: next.key, nextLabel: next.label, currentKey, countdown: `${pad(hh)}:${pad(mm)}:${pad(ss)}` };
  }, [now, rows]);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <span className={styles.kicker}>Sıradaki Vakit</span>
          <div className={styles.nextName}>{state ? state.nextLabel : '—'}</div>
        </div>
        <div className={styles.countdownWrap}>
          <span className={styles.countdown} suppressHydrationWarning>
            {state ? state.countdown : '--:--:--'}
          </span>
          <span className={styles.countdownHint}>kaldı</span>
        </div>
      </div>

      <ul className={styles.list}>
        {rows.map((r) => {
          const isNext = state?.nextKey === r.key;
          const isCurrent = state?.currentKey === r.key;
          return (
            <li
              key={r.key}
              className={`${styles.row} ${isNext ? styles.rowNext : ''} ${isCurrent ? styles.rowCurrent : ''}`}
            >
              <span className={styles.rowIcon} aria-hidden="true">{r.icon}</span>
              <span className={styles.rowLabel}>{r.label}</span>
              {isNext && <span className={styles.tag}>sıradaki</span>}
              {isCurrent && <span className={styles.tagCurrent}>şu an</span>}
              <span className={styles.rowTime}>{r.time || '—'}</span>
            </li>
          );
        })}
      </ul>

      <div className={styles.foot}>
        <span>Çanakkale · Diyanet (Aladhan)</span>
        {data.hijri && <span>{data.hijri}</span>}
      </div>
    </div>
  );
}
