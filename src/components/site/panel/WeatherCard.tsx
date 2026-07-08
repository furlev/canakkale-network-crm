'use client';

import { useState } from 'react';
import { useMotionTier } from '@/components/site/motion/MotionProvider';
import PanelCard from './PanelCard';
import styles from './WeatherCard.module.css';
import type { WeatherData, WeatherDay, DistrictForecast } from '@/lib/citydata';

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

/** WMO hava kodu → Türkçe etiket + emoji + animasyon türü. İstemci-güvenli saf fonksiyon. */
export function weatherCodeInfo(code: number | null): { label: string; emoji: string; kind: WeatherKind } {
  switch (code) {
    case 0:
      return { label: 'Açık', emoji: '☀️', kind: 'clear' };
    case 1:
      return { label: 'Az bulutlu', emoji: '🌤️', kind: 'partly' };
    case 2:
      return { label: 'Parçalı bulutlu', emoji: '⛅', kind: 'partly' };
    case 3:
      return { label: 'Kapalı', emoji: '☁️', kind: 'cloudy' };
    case 45:
    case 48:
      return { label: 'Sisli', emoji: '🌫️', kind: 'fog' };
    case 51:
    case 53:
    case 55:
      return { label: 'Çisenti', emoji: '🌦️', kind: 'drizzle' };
    case 56:
    case 57:
      return { label: 'Dondurucu çisenti', emoji: '🌧️', kind: 'drizzle' };
    case 61:
    case 63:
    case 65:
      return { label: 'Yağmurlu', emoji: '🌧️', kind: 'rain' };
    case 66:
    case 67:
      return { label: 'Dondurucu yağmur', emoji: '🌧️', kind: 'rain' };
    case 71:
    case 73:
    case 75:
    case 77:
      return { label: 'Karlı', emoji: '❄️', kind: 'snow' };
    case 80:
    case 81:
    case 82:
      return { label: 'Sağanak', emoji: '🌦️', kind: 'rain' };
    case 85:
    case 86:
      return { label: 'Kar sağanağı', emoji: '🌨️', kind: 'snow' };
    case 95:
      return { label: 'Gök gürültülü', emoji: '⛈️', kind: 'storm' };
    case 96:
    case 99:
      return { label: 'Dolu fırtınası', emoji: '⛈️', kind: 'storm' };
    default:
      return { label: 'Bilinmiyor', emoji: '🌡️', kind: 'cloudy' };
  }
}

export function formatTemp(n: number | null): string {
  return n == null || !Number.isFinite(n) ? '—' : `${Math.round(n)}°`;
}

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Bugün';
  if (index === 1) return 'Yarın';
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('tr-TR', { weekday: 'short' });
}

/** Animasyonlu SVG hava ikonu — kind'e göre güneş/bulut/yağmur/kar/şimşek/sis. */
function AnimatedWeatherIcon({ kind, animate, size = 84 }: { kind: WeatherKind; animate: boolean; size?: number }) {
  const sun = kind === 'clear' || kind === 'partly';
  const cloud = kind !== 'clear';
  const drops = kind === 'drizzle' || kind === 'rain' || kind === 'storm';
  const flakes = kind === 'snow';
  const bolt = kind === 'storm';
  const fog = kind === 'fog';
  const a = animate ? styles.on : '';

  return (
    <svg
      className={styles.wIcon}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-hidden="true"
    >
      {sun && (
        <g className={`${styles.sun} ${a}`} style={{ transformOrigin: cloud ? '36px 38px' : '50px 46px' }}>
          <circle cx={cloud ? 36 : 50} cy={cloud ? 38 : 46} r={cloud ? 13 : 17} className={styles.sunCore} />
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={i}
              className={styles.ray}
              x1={cloud ? 36 : 50}
              y1={cloud ? 38 : 46}
              x2={cloud ? 36 : 50}
              y2={cloud ? 12 : 18}
              transform={`rotate(${i * 45} ${cloud ? 36 : 50} ${cloud ? 38 : 46})`}
            />
          ))}
        </g>
      )}
      {cloud && (
        <g className={`${styles.cloud} ${a}`}>
          <path
            className={styles.cloudBody}
            d="M32 66 a15 15 0 0 1 2 -29 a20 20 0 0 1 38 4 a13 13 0 0 1 -3 25 z"
          />
        </g>
      )}
      {drops &&
        [30, 45, 60, 72].map((x, i) => (
          <line
            key={x}
            className={`${styles.drop} ${a}`}
            x1={x}
            y1={70}
            x2={x - 3}
            y2={82}
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      {flakes &&
        [32, 48, 64].map((x, i) => (
          <text
            key={x}
            className={`${styles.flake} ${a}`}
            x={x}
            y={80}
            style={{ animationDelay: `${i * 0.35}s` }}
          >
            ❄
          </text>
        ))}
      {bolt && <polygon className={`${styles.bolt} ${a}`} points="50,64 42,82 50,80 46,94 60,74 51,76" />}
      {fog &&
        [70, 78, 86].map((y, i) => (
          <line
            key={y}
            className={`${styles.fogLine} ${a}`}
            x1={22}
            y1={y}
            x2={78}
            y2={y}
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}
    </svg>
  );
}

function DayStrip({ days, animate }: { days: WeatherDay[]; animate: boolean }) {
  return (
    <div className={styles.days}>
      {days.slice(0, 6).map((d, i) => {
        const info = weatherCodeInfo(d.weatherCode);
        return (
          <div key={d.date} className={styles.day}>
            <span className={styles.dayName}>{dayLabel(d.date, i)}</span>
            <span className={styles.dayEmoji} aria-hidden="true">
              {info.emoji}
            </span>
            <span className={styles.dayTemps}>
              <b>{formatTemp(d.tempMax)}</b>
              <i>{formatTemp(d.tempMin)}</i>
            </span>
            {d.precipProb != null && d.precipProb >= 20 && (
              <span className={styles.dayRain}>💧{Math.round(d.precipProb)}%</span>
            )}
            {animate && d.waveMax != null && (
              <span className={styles.dayWave}>🌊{d.waveMax.toFixed(1)}m</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hava durumu kartı: ilçe sekmeleri + seçili ilçenin anlık durumu (animasyonlu ikon) +
 * bugün + 5 gün şeridi. Kıyı ilçelerde deniz dalga bilgisi de görünür.
 */
export default function WeatherCard({
  data,
  initialDistrict,
  href = '/hava',
  compact,
}: {
  data: WeatherData | null;
  initialDistrict?: string;
  href?: string;
  compact?: boolean;
}) {
  const tier = useMotionTier();
  const animate = tier !== 'off';
  const districts = data?.districts ?? [];
  const startIdx = Math.max(
    0,
    districts.findIndex((d) => d.slug === initialDistrict),
  );
  const [idx, setIdx] = useState(startIdx === -1 ? 0 : startIdx);
  const sel: DistrictForecast | undefined = districts[idx] ?? districts[0];

  if (!sel) {
    return (
      <PanelCard title="Hava Durumu" icon="🌤️" kicker="Çanakkale" href={href}>
        <p className={styles.empty}>Hava durumu verisi henüz hazırlanmadı. Kısa süre içinde güncellenecek.</p>
      </PanelCard>
    );
  }

  const info = weatherCodeInfo(sel.current.weatherCode);

  const tabs = (
    <div className={styles.tabs} role="tablist" aria-label="İlçe seç">
      {districts.map((d, i) => (
        <button
          key={d.slug}
          type="button"
          role="tab"
          aria-selected={i === idx}
          className={`${styles.tab} ${i === idx ? styles.tabActive : ''}`}
          onClick={() => setIdx(i)}
        >
          {d.name}
        </button>
      ))}
    </div>
  );

  return (
    <PanelCard
      title="Hava Durumu"
      icon="🌤️"
      kicker={sel.name}
      href={href}
      accent="#2f7db9"
    >
      {!compact && <div className={styles.tabsWrap}>{tabs}</div>}

      <div className={styles.now}>
        <AnimatedWeatherIcon kind={info.kind} animate={animate} />
        <div className={styles.nowText}>
          <span className={styles.temp}>{formatTemp(sel.current.temp)}</span>
          <span className={styles.cond}>{info.label}</span>
          <span className={styles.sub}>
            {sel.current.windSpeed != null && <>Rüzgâr {Math.round(sel.current.windSpeed)} km/s</>}
            {sel.days[0]?.tempMax != null && sel.days[0]?.tempMin != null && (
              <>
                {' · '}
                {formatTemp(sel.days[0].tempMax)}/{formatTemp(sel.days[0].tempMin)}
              </>
            )}
          </span>
          {sel.coastal && sel.days[0]?.waveMax != null && (
            <span className={styles.wave}>🌊 Dalga {sel.days[0].waveMax.toFixed(1)} m</span>
          )}
        </div>
      </div>

      <DayStrip days={sel.days} animate={animate} />
    </PanelCard>
  );
}
