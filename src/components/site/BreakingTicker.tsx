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

export type TickerMode = 'breaking' | 'gundem';

/**
 * Son dakika şeridi 2.0: kesintisiz marquee + canlı TR saati + geliştirmeler:
 *  - İki mod: 'breaking' (kızıl SON DAKİKA) · 'gundem' (nötr lacivert GÜNDEM —
 *    son 24 saatte son dakika yoksa layout en yeni haberlerle doldurur).
 *  - Sol rozet nabızlı; breaking'de /son-dakika arşivine, gündem'de /haberler'e link.
 *  - Her öğede kategori renk noktası; öğeler /haber/[slug]'a tıklanabilir.
 *  - Hover/odakta marquee DURUR (okunabilirlik); reduced-motion'da statik liste.
 *  - 60 sn'de bir /api/site/breaking?since= ile yoklama: yeni haber gelince listeye
 *    başa eklenir ve BreakingToast tetiklenir (kuyruklu). Gündem modundayken gerçek
 *    son dakika düşerse şerit kızıl 'breaking' moduna döner.
 *  - reduced-motion / tier 'off': nabız kapalı, statik liste, animasyonsuz toast.
 *
 * Toast bu bileşenin içinde render edilir — ekstra layout mount gerekmez.
 */
export default function BreakingTicker({
  items: initial,
  mode: initialMode = 'breaking',
}: {
  items: TickerItem[];
  mode?: TickerMode;
}) {
  const tier = useMotionTier();
  const noMotion = tier === 'off';

  const [items, setItems] = useState<TickerItem[]>(initial);
  const [mode, setMode] = useState<TickerMode>(initialMode);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [clock, setClock] = useState<string | null>(null);
  // Yeni gelen öğelerin slug'ları — kızıl "is-entering" flash için (kısa süre).
  const [entering, setEntering] = useState<Set<string>>(() => new Set());

  // Görülen slug'lar (toast tekrarını ve çift eklemeyi önler) + son sunucu zamanı.
  const seenRef = useRef<Set<string>>(new Set(initial.map(i => i.slug)));
  const sinceRef = useRef<string>(new Date().toISOString());
  // Mod, callback deps'ine girmeden okunabilsin diye ref'te de tutulur.
  const modeRef = useRef<TickerMode>(initialMode);

  /**
   * Sunucudan gelen son dakika yanıtını (polling VEYA SSE) tek noktada işler:
   * yeni (görülmemiş) haberleri başa ekler, toast kuyruğuna atar, `since`i ilerletir
   * ve giren öğelere kızıl flash işareti koyar. Çift kanal güvenli — seenRef dedup eder.
   * Gündem modunda gelen İLK gerçek son dakika şeridi kızıl 'breaking' moduna çevirir
   * (gündem dolgu listesi yerini son dakika listesine bırakır).
   */
  const applyIncoming = useCallback((data: { now?: string; items?: BreakingApiItem[] }) => {
    if (data.now) sinceRef.current = data.now;
    const wasGundem = modeRef.current === 'gundem';
    // Gündem dolgusundaki bir haber sonradan son dakika işaretlenebilir → gündemde seen filtresi atlanır.
    const fresh = (data.items ?? []).filter(it => wasGundem || !seenRef.current.has(it.slug));
    if (fresh.length === 0) return;

    // API en yeni → eski sıralı; başa eklerken bu sırayı koru (en yeni en solda).
    const asTicker: TickerItem[] = fresh.map(it => ({
      slug: it.slug,
      title: it.title,
      timeAgo: timeAgoTr(it.publishedAt),
      color: it.color,
    }));
    if (wasGundem) {
      // Gündem dolgusu yerini gerçek son dakika listesine bırakır; dedup seti sıfırlanır.
      modeRef.current = 'breaking';
      setMode('breaking');
      seenRef.current = new Set(fresh.map(it => it.slug));
      setItems(asTicker);
    } else {
      fresh.forEach(it => seenRef.current.add(it.slug));
      setItems(prev => [...asTicker, ...prev].slice(0, 20));
    }

    // Kızıl flash işareti (yeni slug'lar) — ~1.6 sn sonra kaldır.
    const freshSlugs = fresh.map(it => it.slug);
    setEntering(prev => {
      const next = new Set(prev);
      freshSlugs.forEach(s => next.add(s));
      return next;
    });
    window.setTimeout(() => {
      setEntering(prev => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        freshSlugs.forEach(s => next.delete(s));
        return next;
      });
    }, 1600);

    // Toast kuyruğu (eskiden yeniye sıralı ki en yeni en son anons edilsin).
    const asToast: ToastItem[] = [...fresh]
      .reverse()
      .map(it => ({ id: it.id, slug: it.slug, title: it.title }));
    setToasts(prev => [...prev, ...asToast]);
  }, []);

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

  // 60 sn polling — SSE fallback'i (SSE çalışsa bile açık kalır; seenRef çift eklemeyi
  // engeller). Yeni son dakika haberlerini başa ekler + toast kuyruğuna atar.
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
        applyIncoming(data);
      } catch {
        /* ağ hatası — sessiz geç, bir sonraki turda tekrar dener */
      }
    };

    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [applyIncoming]);

  // SSE — anlık son dakika akışı (/api/site/breaking-stream). Bağlantı kurulunca
  // 15 sn'de bir data olayı gelir; hata olursa EventSource kapatılır ve yukarıdaki
  // 60 sn polling devralır (fallback). EventSource yoksa (eski tarayıcı) sessiz atlanır.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return;

    let es: EventSource | null = null;

    try {
      es = new EventSource(`/api/site/breaking-stream?since=${encodeURIComponent(sinceRef.current)}`);
    } catch {
      return; // kurulamadı → polling fallback zaten çalışıyor
    }

    es.onmessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as { now?: string; items?: BreakingApiItem[] };
        applyIncoming(data);
      } catch {
        /* bozuk kare — yoksay */
      }
    };

    es.onerror = () => {
      // Otomatik yeniden bağlanma fırtınasını durdur; polling fallback devralır.
      es?.close();
    };

    return () => {
      es?.close();
    };
  }, [applyIncoming]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (items.length === 0) return null;

  const animate = !noMotion;
  // Statik modda tek liste; hareketli modda kesintisiz marquee için iki kez basılır.
  const rendered = animate ? [...items, ...items] : items;
  const duration = Math.max(items.length * 9, 20);

  // Süre öğe sayısına göre; hover/odakta durma CSS'ten gelir (.ticker-track:hover { paused }).
  const trackStyle: React.CSSProperties | undefined = animate
    ? { animationDuration: `${duration}s` }
    : undefined;

  const isGundem = mode === 'gundem';

  return (
    <div
      className="ticker"
      data-mode={mode}
      role="region"
      aria-label={isGundem ? 'Gündem haberleri' : 'Son dakika haberleri'}
    >
      <Link
        href={isGundem ? '/haberler' : '/son-dakika'}
        className="ticker-label"
        aria-label={isGundem ? 'Gündem haberleri — tüm haberler' : 'Son dakika haberleri — tüm arşiv'}
      >
        <span
          className="ticker-dot"
          aria-hidden="true"
          style={noMotion ? { animation: 'none' } : undefined}
        />
        {isGundem ? 'GÜNDEM' : 'SON DAKİKA'}
      </Link>
      <div className="ticker-viewport">
        <div className="ticker-track" style={trackStyle}>
          {rendered.map((item, i) => {
            const isClone = animate && i >= items.length;
            const isNew = !noMotion && entering.has(item.slug);
            return (
              <Link
                key={`${item.slug}-${i}`}
                href={`/haber/${item.slug}`}
                className={`ticker-item${isNew ? ' is-entering' : ''}`}
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
