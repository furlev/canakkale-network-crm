'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './FerryBoard.module.css';

/**
 * Feribot tarife panosu + rota bazında "sıradaki sefer" geri sayımı.
 *
 * Sefer verisi sunucudan gelir (aktif FerrySchedule satırları). Sıradaki sefer,
 * ziyaretçi cihazının YEREL saatine ve haftanın gününe göre hesaplanır (hedef kitle
 * Çanakkale — TR yerel saati). `days` alanı: hergun | haftaici | haftasonu.
 * Deniz durumu (dalga/rüzgâr) Open-Meteo marine cache'inden gelir (citydata).
 */

export type FerryTrip = {
  id: string;
  route: string;
  departTime: string; // "HH:MM"
  days: string; // hergun | haftaici | haftasonu
  operator: string;
  season: string | null;
};

export type SeaState = {
  wave: number | null; // m
  wind: number | null; // km/s
} | null;

const DAY_LABEL: Record<string, string> = {
  hergun: 'Her gün',
  haftaici: 'Hafta içi',
  haftasonu: 'Hafta sonu',
};

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

/** JS getDay() (0=Paz) → hafta sonu mu? */
function isWeekend(day: number): boolean {
  return day === 0 || day === 6;
}

/** Sefer, verilen gün tipinde geçerli mi? */
function appliesOn(trip: FerryTrip, weekend: boolean): boolean {
  if (trip.days === 'hergun') return true;
  return weekend ? trip.days === 'haftasonu' : trip.days === 'haftaici';
}

export default function FerryBoard({ trips, sea }: { trips: FerryTrip[]; sea: SeaState }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Rotaya göre grupla (kalkış saatine göre sıralı)
  const routes = useMemo(() => {
    const map = new Map<string, FerryTrip[]>();
    for (const t of trips) {
      if (!map.has(t.route)) map.set(t.route, []);
      map.get(t.route)!.push(t);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (toMinutes(a.departTime) ?? 0) - (toMinutes(b.departTime) ?? 0));
    }
    return Array.from(map.entries()).map(([route, list]) => ({ route, list }));
  }, [trips]);

  /** Bir rotanın sıradaki seferini + geri sayımını hesaplar. */
  const nextFor = (list: FerryTrip[]) => {
    if (!now) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const weekendToday = isWeekend(now.getDay());
    const weekendTomorrow = isWeekend((now.getDay() + 1) % 7);

    // Bugün için geçerli ve henüz gelmemiş seferler
    const todayLater = list
      .filter((t) => appliesOn(t, weekendToday))
      .map((t) => ({ t, min: toMinutes(t.departTime) }))
      .filter((x) => x.min !== null && (x.min as number) > nowMin)
      .sort((a, b) => (a.min as number) - (b.min as number));

    let target: { t: FerryTrip; min: number } | null = null;
    let dayLabel = 'Bugün';

    if (todayLater.length > 0) {
      target = { t: todayLater[0].t, min: todayLater[0].min as number };
    } else {
      // Yarının ilk geçerli seferi
      const tomorrow = list
        .filter((t) => appliesOn(t, weekendTomorrow))
        .map((t) => ({ t, min: toMinutes(t.departTime) }))
        .filter((x) => x.min !== null)
        .sort((a, b) => (a.min as number) - (b.min as number));
      if (tomorrow.length > 0) {
        target = { t: tomorrow[0].t, min: (tomorrow[0].min as number) + 24 * 60 };
        dayLabel = 'Yarın';
      }
    }

    if (!target) return null;
    const diffSec = Math.max(0, Math.round((target.min - nowMin) * 60));
    const hh = Math.floor(diffSec / 3600);
    const mm = Math.floor((diffSec % 3600) / 60);
    return {
      time: target.t.departTime,
      dayLabel,
      countdown: hh > 0 ? `${hh} sa ${pad(mm)} dk` : `${mm} dk`,
    };
  };

  return (
    <div className={styles.board}>
      {sea && (sea.wave !== null || sea.wind !== null) && (
        <div className={styles.sea}>
          <span className={styles.seaIcon} aria-hidden="true">🌊</span>
          <span className={styles.seaLabel}>Boğaz deniz durumu</span>
          <span className={styles.seaVals}>
            {sea.wave !== null && <span>Dalga ~{sea.wave.toFixed(1)} m</span>}
            {sea.wind !== null && <span>Rüzgâr ~{Math.round(sea.wind)} km/s</span>}
          </span>
        </div>
      )}

      {routes.length === 0 ? (
        <div className={styles.empty}>Tarife henüz girilmedi.</div>
      ) : (
        <div className={styles.routes}>
          {routes.map(({ route, list }) => {
            const next = nextFor(list);
            const operator = list[0]?.operator || 'GESTAŞ';
            return (
              <article key={route} className={styles.route}>
                <header className={styles.routeHead}>
                  <div>
                    <h3 className={styles.routeName}>{route}</h3>
                    <span className={styles.operator}>{operator}</span>
                  </div>
                  <div className={styles.next}>
                    {next ? (
                      <>
                        <span className={styles.nextTime} suppressHydrationWarning>{next.time}</span>
                        <span className={styles.nextHint} suppressHydrationWarning>
                          {next.dayLabel} · {next.countdown} sonra
                        </span>
                      </>
                    ) : (
                      <span className={styles.nextHint}>Sefer bilgisi yok</span>
                    )}
                  </div>
                </header>
                <ul className={styles.times}>
                  {list.map((t) => (
                    <li key={t.id} className={styles.time} title={DAY_LABEL[t.days] || t.days}>
                      <span>{t.departTime}</span>
                      {t.days !== 'hergun' && <em className={styles.dayTag}>{DAY_LABEL[t.days]}</em>}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
