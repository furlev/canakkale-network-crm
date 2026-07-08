'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export type TickerItem = {
  slug: string;
  title: string;
  /** Sunucuda timeAgoTr ile hazırlanmış etiket ("12 dakika önce") */
  timeAgo: string;
};

/**
 * Son dakika şeridi: kızıl marquee + canlı TR saati.
 * Haber yoksa layout zaten render etmez; yine de güvenlik için boş dizide null döner.
 */
export default function BreakingTicker({ items }: { items: TickerItem[] }) {
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (items.length === 0) return null;

  // Kesintisiz akış için liste iki kez basılır; kopyalar erişilebilirlikten gizlenir
  const loop = [...items, ...items];
  const duration = Math.max(items.length * 9, 20);

  return (
    <div className="ticker" role="region" aria-label="Son dakika haberleri">
      <span className="ticker-label">
        <span className="ticker-dot" aria-hidden="true" />
        SON DAKİKA
      </span>
      <div className="ticker-viewport">
        <div className="ticker-track" style={{ animationDuration: `${duration}s` }}>
          {loop.map((item, i) => {
            const isClone = i >= items.length;
            return (
              <Link
                key={`${item.slug}-${i}`}
                href={`/haber/${item.slug}`}
                className="ticker-item"
                tabIndex={isClone ? -1 : 0}
                aria-hidden={isClone || undefined}
              >
                <span className="ticker-sep" aria-hidden="true">●</span>
                <span className="ticker-title">{item.title}</span>
                {item.timeAgo && <span className="ticker-time">{item.timeAgo}</span>}
              </Link>
            );
          })}
        </div>
      </div>
      <time className="ticker-clock" aria-label="Şu anki saat" suppressHydrationWarning>
        {clock ?? '--:--:--'}
      </time>
    </div>
  );
}
