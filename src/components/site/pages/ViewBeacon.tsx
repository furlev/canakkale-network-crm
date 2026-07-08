'use client';

import { useEffect } from 'react';

/**
 * Haber okuma analitiği (first-party, KVKK-dostu).
 *
 *  1) Görüntülenme: mount'ta bir kez /api/site/view'a POST (mevcut davranış korunur;
 *     sessionStorage ile aynı oturumda tekrar sayılmaz). Ek: document.referrer'ın
 *     host'u trafik kaynağı için gönderilir. Sunucu bu istekte views++ yapar VE
 *     bir ArticleEvent('view') yazar.
 *  2) Okuma tamamlama: sayfa ~%90 kaydırıldığında bir kez 'read_complete' olayı
 *     /api/site/event'e sendBeacon ile atılır.
 *  3) Dış link tıklaması: farklı host'a giden bir <a> tıklandığında 'outbound_click'
 *     olayı (gidilen host referrerHost alanında) sendBeacon ile atılır.
 *
 * Tüm çağrılar sessiz-hata toleranslıdır; analitik hiçbir zaman okuma deneyimini kırmaz.
 */
export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    // document.referrer'dan yalnız dış host (site içi/boş → undefined = doğrudan)
    const refHost = (): string | undefined => {
      try {
        if (!document.referrer) return undefined;
        const u = new URL(document.referrer);
        if (u.hostname === location.hostname) return undefined;
        return u.hostname.slice(0, 120);
      } catch {
        return undefined;
      }
    };

    // /api/site/event'e olay gönder (sendBeacon → fetch fallback)
    const sendEvent = (type: 'read_complete' | 'outbound_click' | 'share', referrerHost?: string) => {
      const payload = JSON.stringify({ slug, type, referrerHost });
      try {
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon && navigator.sendBeacon('/api/site/event', blob)) return;
      } catch {
        /* sendBeacon yoksa fetch'e düş */
      }
      fetch('/api/site/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        /* analitik kritik değil */
      });
    };

    // ── 1) Görüntülenme (mevcut davranış + referrerHost) ──
    const viewKey = `cn-viewed:${slug}`;
    let alreadyViewed = false;
    try {
      alreadyViewed = !!sessionStorage.getItem(viewKey);
      if (!alreadyViewed) sessionStorage.setItem(viewKey, '1');
    } catch {
      /* sessionStorage kapalıysa yine de tek atış yapılır */
    }
    if (!alreadyViewed) {
      fetch('/api/site/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, referrerHost: refHost() }),
        keepalive: true,
      }).catch(() => {
        /* sayaç kritik değil — sessiz geç */
      });
    }

    // ── 2) Okuma tamamlama (scroll-depth ~%90, oturumda bir kez) ──
    const readKey = `cn-read:${slug}`;
    let readFired = false;
    try {
      readFired = !!sessionStorage.getItem(readKey);
    } catch {
      /* yoksay */
    }

    const onScroll = () => {
      if (readFired) return;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // Çok kısa sayfa (kaydırma yok) → okuma sayılmaz
      if (scrollable <= 0) return;
      const ratio = (window.scrollY || doc.scrollTop) / scrollable;
      if (ratio >= 0.9) {
        readFired = true;
        try {
          sessionStorage.setItem(readKey, '1');
        } catch {
          /* yoksay */
        }
        sendEvent('read_complete');
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // ── 3) Dış link tıklaması ──
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href) return;
      try {
        const u = new URL(href, location.href);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
        if (u.hostname === location.hostname) return; // site içi bağlantı sayılmaz
        // outbound_click: gidilen host referrerHost alanında saklanır
        sendEvent('outbound_click', u.hostname.slice(0, 120));
      } catch {
        /* geçersiz URL → yoksay */
      }
    };
    document.addEventListener('click', onClick, { capture: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, [slug]);

  return null;
}
