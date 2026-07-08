'use client';

import { useEffect, useRef, useState } from 'react';
import { useMotionTier } from '@/components/site/motion/MotionProvider';
import PanelCard from './PanelCard';
import styles from './MarketTicker.module.css';
import type { MarketData, MarketQuote } from '@/lib/citydata';

/** TRY biçimi: 46.8607 → "46,86". İstemci-güvenli saf fonksiyon. */
export function formatTRY(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Değişim yüzdesi: 0.12 → "+0,12%" · -0.73 → "-0,73%". */
export function formatChange(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

const ICONS: Record<string, string> = {
  USD: '💵',
  EUR: '💶',
  'gram-altin': '🥇',
  'ceyrek-altin': '🪙',
};

/** Gün içi değişimi kodlayan küçük eğim çizgisi (uydurma tarih değil — işaret/büyüklük görseli). */
function TrendLine({ pct }: { pct: number | null }) {
  const p = pct ?? 0;
  const slope = Math.max(-10, Math.min(10, p)); // -10..10 aralığına kırp
  const y1 = 14;
  const y2 = 14 - slope * 1.1;
  const up = p >= 0;
  return (
    <svg className={styles.trend} width="52" height="28" viewBox="0 0 52 28" aria-hidden="true">
      <line
        x1="2"
        y1={y1}
        x2="50"
        y2={Math.max(2, Math.min(26, y2))}
        className={up ? styles.trendUp : styles.trendDown}
      />
    </svg>
  );
}

function QuoteTile({ q, animate }: { q: MarketQuote; animate: boolean }) {
  const prev = useRef<number | null>(q.selling);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const before = prev.current;
    if (animate && before != null && q.selling != null && q.selling !== before) {
      setFlash(q.selling > before ? 'up' : 'down');
      const id = window.setTimeout(() => setFlash(null), 900);
      prev.current = q.selling;
      return () => window.clearTimeout(id);
    }
    prev.current = q.selling;
  }, [q.selling, animate]);

  const dir = q.changePct == null ? 'flat' : q.changePct > 0 ? 'up' : q.changePct < 0 ? 'down' : 'flat';

  return (
    <div className={`${styles.tile} ${flash ? styles[`flash_${flash}`] : ''}`}>
      <div className={styles.tileTop}>
        <span className={styles.tileIcon} aria-hidden="true">
          {ICONS[q.code] || '📈'}
        </span>
        <span className={styles.tileLabel}>{q.label}</span>
      </div>
      <div className={styles.price}>
        <span className={styles.priceVal}>{formatTRY(q.selling)}</span>
        <span className={styles.priceCur}>₺</span>
      </div>
      <div className={styles.tileBottom}>
        <span className={`${styles.change} ${styles[`c_${dir}`]}`}>
          {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'} {formatChange(q.changePct) || '0,00%'}
        </span>
        <TrendLine pct={q.changePct} />
      </div>
      {q.buying != null && <span className={styles.buying}>Alış {formatTRY(q.buying)} ₺</span>}
    </div>
  );
}

/**
 * Piyasa kartı: USD/EUR/gram+çeyrek altın kutucukları. Değer güncellenince yeşil/kırmızı
 * flash; değişime göre yön oku + eğim çizgisi. MotionProvider tier'ına saygılı.
 */
export default function MarketTicker({
  data,
  href = '/piyasa',
  stale,
}: {
  data: MarketData | null;
  href?: string;
  stale?: boolean;
}) {
  const tier = useMotionTier();
  const animate = tier !== 'off';
  const quotes = data?.quotes ?? [];

  return (
    <PanelCard
      title="Piyasa"
      icon="📈"
      kicker="Döviz & Altın"
      href={href}
      accent="#2fb96b"
      stale={stale}
      updatedLabel={data?.updatedLabel ? `Kaynak: ${data.updatedLabel}` : null}
      footnote="Kaynak: truncgil finans · Yatırım tavsiyesi değildir."
    >
      {quotes.length === 0 ? (
        <p className={styles.empty}>Piyasa verisi henüz hazırlanmadı. Kısa süre içinde güncellenecek.</p>
      ) : (
        <div className={styles.grid}>
          {quotes.map((q) => (
            <QuoteTile key={q.code} q={q} animate={animate} />
          ))}
        </div>
      )}
    </PanelCard>
  );
}
