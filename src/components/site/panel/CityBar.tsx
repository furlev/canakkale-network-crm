'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMotionTier } from '@/components/site/motion/MotionProvider';
import { weatherCodeInfo, formatTemp } from './WeatherCard';
import { formatTRY } from './MarketTicker';
import styles from './CityBar.module.css';
import type { MarketData, WeatherData, PharmacyEntry } from '@/lib/citydata';

type CityResponse = {
  market: MarketData | null;
  weather: WeatherData | null;
  pharmacy: { date: string | null; entries: PharmacyEntry[] };
  stale?: { market: boolean; weather: boolean };
};

const POLL_MS = 5 * 60_000; // 5 dk

/**
 * Header altı kompakt şehir şeridi: Merkez sıcaklığı + hava ikonu, USD & gram altın,
 * "Bugün nöbetçi" özeti. /api/site/city'den kendi verisini çeker (5 dk polling) — layout'a
 * prop geçmeden mount edilebilir. Tema-duyarlı, MotionProvider tier'ına saygılı.
 */
export default function CityBar() {
  const tier = useMotionTier();
  const animate = tier !== 'off';
  const [data, setData] = useState<CityResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await fetch('/api/site/city', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as CityResponse;
        if (!cancelled) setData(json);
      } catch {
        /* ağ hatası — sonraki turda tekrar dener */
      }
    };
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Merkez (yoksa ilk ilçe) hava
  const districts = data?.weather?.districts ?? [];
  const wx = districts.find((d) => d.slug === 'merkez') ?? districts[0];
  const info = wx ? weatherCodeInfo(wx.current.weatherCode) : null;

  const usd = data?.market?.quotes.find((q) => q.code === 'USD') ?? null;
  const gram = data?.market?.quotes.find((q) => q.code === 'gram-altin') ?? null;

  const pharm = data?.pharmacy?.entries ?? [];
  const pharmMerkez = pharm.find((e) => e.districtSlug === 'merkez') ?? pharm[0];

  const loading = data === null;
  // Veri henüz yokken '—' yerine zarif iskelet hapı göster.
  const skel = <span className={styles.skel} aria-hidden="true" />;

  return (
    <div className={`${styles.bar} ${animate ? styles.animate : ''}`} role="region" aria-label="Şehir panosu özeti">
      <div className={`s-container ${styles.inner}`}>
        {/* Hava */}
        <Link href="/hava" className={styles.item} aria-label="Hava durumu detayları">
          <span className={styles.emoji} aria-hidden="true">
            {info?.emoji ?? '🌡️'}
          </span>
          <span className={styles.val}>{wx ? formatTemp(wx.current.temp) : loading ? skel : '—'}</span>
          <span className={styles.lbl}>{info?.label ?? 'Hava'}</span>
        </Link>

        <span className={styles.sep} aria-hidden="true" />

        {/* Döviz + Altın */}
        <Link href="/piyasa" className={styles.item} aria-label="Piyasa detayları">
          <span className={styles.tag}>USD</span>
          <span className={styles.val}>{usd ? `${formatTRY(usd.selling)}₺` : loading ? skel : '—'}</span>
          {usd?.changePct != null && (
            <span className={usd.changePct >= 0 ? styles.up : styles.down}>
              {usd.changePct >= 0 ? '▲' : '▼'}
            </span>
          )}
        </Link>

        <Link href="/piyasa" className={`${styles.item} ${styles.hideSm}`} aria-label="Altın fiyatı">
          <span className={styles.tag}>Gram Altın</span>
          <span className={styles.val}>{gram ? `${formatTRY(gram.selling)}₺` : loading ? skel : '—'}</span>
        </Link>

        <span className={styles.sep} aria-hidden="true" />

        {/* Nöbetçi eczane */}
        <Link href="/nobetci-eczane" className={`${styles.item} ${styles.pharm}`} aria-label="Nöbetçi eczaneler">
          <span className={styles.emoji} aria-hidden="true">
            ⚕️
          </span>
          <span className={styles.lbl}>
            {pharmMerkez ? (
              <>
                <b>Bugün nöbetçi:</b> {pharmMerkez.name}
              </>
            ) : loading ? (
              'Nöbetçi eczane'
            ) : (
              'Nöbetçi eczaneler'
            )}
          </span>
        </Link>

        <span className={styles.sep} aria-hidden="true" />

        {/* Namaz vakitleri */}
        <Link href="/namaz" className={styles.item} aria-label="Namaz vakitleri">
          <span className={styles.emoji} aria-hidden="true">
            🕌
          </span>
          <span className={styles.lbl}>Namaz</span>
        </Link>

        {/* Feribot seferleri */}
        <Link href="/feribot" className={`${styles.item} ${styles.hideSm}`} aria-label="Feribot seferleri">
          <span className={styles.emoji} aria-hidden="true">
            ⛴️
          </span>
          <span className={styles.lbl}>Feribot</span>
        </Link>
      </div>
    </div>
  );
}
