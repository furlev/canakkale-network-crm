'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMotionTier } from '@/components/site/motion/MotionProvider';
import BreakingToast, { type ToastItem } from '@/components/site/BreakingToast';

export type TickerItem = {
  slug: string;
  title: string;
  /** Sunucuda timeAgoTr ile hazırlanmış etiket ("12 dakika önce"). Boş olabilir. */
  timeAgo: string;
  /** Kategori vurgu rengi (SiteCategory.color) — renk noktası için, opsiyonel. */
  color?: string | null;
};

/** API yanıtındaki tek son dakika kaydı (bkz. /api/site/breaking). */
type BreakingApiItem = {
  id: string;
  slug: string;
  title: string;
  categorySlug: string | null;
  categoryName: string | null;
  color: string | null;
  publishedAt: string | null;
};

const POLL_MS = 60_000;

/** Client-side "5 dakika önce" — site.ts server-only (prisma import) olduğu için burada kopya. */
function timeAgoTr(iso: string | null): string {
  if (!iso) return '';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'az önce';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dakika önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Son dakika şeridi 2.0: kızıl marquee + canlı TR saati + geliştirmeler:
 *  - Sol "SON DAKİKA" rozetinde nabız; rozet son dakika arşivine (/son-dakika) link.
 *  - Her öğede kategori renk noktası.
 *  - Hover/odakta marquee yavaşlar (durmadan okunabilir).
 *  - 60 sn'de bir /api/site/breaking?since= ile yoklama: yeni haber gelince listeye
 *    başa eklenir ve BreakingToast tetiklenir (kuyruklu).
 *  - reduced-motion / tier 'off': nabız kapalı, statik liste, animasyonsuz toast.
 *
 * Toast bu bileşenin içinde render edilir — ekstra layout mount gerekmez.
 */
export default function BreakingTicker({ items: initial }: { items: TickerItem[] }) {
  const tier = useMotionTier();
  const noMotion = tier === 'off';

  const [items, setItems] = useState<TickerItem[]>(initial);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [clock, setClock] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  // Görülen slug'lar (toast tekrarını ve çift eklemeyi önler) + son sunucu zamanı.
  const seenRef = useRef<Set<string>>(new Set(initial.map(i => i.slug)));
  const sinceRef = useRef<string>(new Date().toISOString());

  // Canlı TR saati (mevcut davranış korunur).
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // 60 sn polling — yeni son dakika haberlerini başa ekle + toast kuyruğuna at.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (typeof document !== 'undefined' && document.hidden) return; // sekme arkadayken boşuna çekme
      try {
        const res = await fetch(`/api/site/breaking?since=${encodeURIComponent(sinceRef.current)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { now?: string; items?: BreakingApiItem[] };
        if (cancelled) return;
        if (data.now) sinceRef.current = data.now;

        const fresh = (data.items ?? []).filter(it => !seenRef.current.has(it.slug));
        if (fresh.length === 0) return;
        fresh.forEach(it => seenRef.current.add(it.slug));

        // API en yeni → eski sıralı; başa eklerken bu sırayı koru (en yeni en solda).
        const asTicker: TickerItem[] = fresh.map(it => ({
          slug: it.slug,
          title: it.title,
          timeAgo: timeAgoTr(it.publishedAt),
          color: it.color,
        }));
        setItems(prev => [...asTicker, ...prev].slice(0, 20));

        // Toast kuyruğu (eskiden yeniye sıralı ki en yeni en son anons edilsin).
        const asToast: ToastItem[] = [...fresh]
          .reverse()
          .map(it => ({ id: it.id, slug: it.slug, title: it.title }));
        setToasts(prev => [...prev, ...asToast]);
      } catch {
        /* ağ hatası — sessiz geç, bir sonraki turda tekrar dener */
      }
    };

    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (items.length === 0) return null;

  const animate = !noMotion;
  // Statik modda tek liste; hareketli modda kesintisiz akış için iki kez basılır.
  const rendered = animate ? [...items, ...items] : items;
  const duration = Math.max(items.length * 9, 20);

  // Inline animationPlayState:'running', global :hover{paused} kuralını ezerek
  // "durma" yerine "yavaşlama" sağlar (duration hover/odakta 2.5×).
  const trackStyle: React.CSSProperties | undefined = animate
    ? { animationDuration: `${slow ? duration * 2.5 : duration}s`, animationPlayState: 'running' }
    : undefined;

  const onSlowOn = () => animate && setSlow(true);
  const onSlowOff = () => animate && setSlow(false);

  return (
    <div className="ticker" role="region" aria-label="Son dakika haberleri">
      <Link href="/son-dakika" className="ticker-label" aria-label="Son dakika haberleri — tüm arşiv">
        <span
          className="ticker-dot"
          aria-hidden="true"
          style={noMotion ? { animation: 'none' } : undefined}
        />
        SON DAKİKA
      </Link>
      <div
        className="ticker-viewport"
        onMouseEnter={onSlowOn}
        onMouseLeave={onSlowOff}
        onFocusCapture={onSlowOn}
        onBlurCapture={onSlowOff}
      >
        <div className="ticker-track" style={trackStyle}>
          {rendered.map((item, i) => {
            const isClone = animate && i >= items.length;
            return (
              <Link
                key={`${item.slug}-${i}`}
                href={`/haber/${item.slug}`}
                className="ticker-item"
                tabIndex={isClone ? -1 : 0}
                aria-hidden={isClone || undefined}
              >
                <span
                  className="ticker-dot-cat"
                  aria-hidden="true"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: item.color || 'rgba(255,255,255,0.7)',
                    boxShadow: item.color && !noMotion ? `0 0 6px ${item.color}` : undefined,
                  }}
                />
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

      <BreakingToast queue={toasts} onDismiss={dismissToast} noMotion={noMotion} />
    </div>
  );
}
