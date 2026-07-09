'use client';

import { useEffect } from 'react';

/** Küçük deterministik string→pozitif tam sayı hash'i (A/B tohumu için). */
function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

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
export default function ViewBeacon({
  slug,
  altTitle,
  articleId,
}: {
  slug: string;
  /** A/B alt başlık (varsa). Ziyaret başına ana/alt başlık dönüşümlü gösterilir. */
  altTitle?: string | null;
  /** Deterministik rotasyon tohumu (yoksa slug kullanılır). */
  articleId?: string | null;
}) {
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

    // ── 0) A/B başlık varyantı (altTitle varsa) ──
    // Ziyaret başına ana/alt başlık dönüşümlü gösterilir: deterministik id-hash%2
    // tohumu + küresel ziyaret rotasyonu ile parite hesaplanır. Aynı oturumdaki
    // tekrar ziyaretlerde seçim sabit kalır (sessionStorage). Seçim /api/site/view'a
    // `v` (main|alt) olarak raporlanır → Setting('titleAbStats') sayacı.
    let variant: 'main' | 'alt' = 'main';
    const hasAlt = !!(altTitle && altTitle.trim());
    if (hasAlt) {
      const varKey = `cn-abvar:${slug}`;
      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem(varKey);
      } catch {
        /* yoksay */
      }
      if (stored === 'main' || stored === 'alt') {
        variant = stored;
      } else {
        const seed = hashInt(articleId || slug);
        let rot = 0;
        try {
          rot = parseInt(localStorage.getItem('cn-ab-rot') || '0', 10) || 0;
          localStorage.setItem('cn-ab-rot', String((rot + 1) % 1_000_000));
        } catch {
          /* localStorage kapalıysa yalnız tohumla belirlenir */
        }
        variant = (seed + rot) % 2 === 0 ? 'main' : 'alt';
        try {
          sessionStorage.setItem(varKey, variant);
        } catch {
          /* yoksay */
        }
      }
      // Alt başlık seçildiyse görünen H1'i güncelle (server ana başlığı render eder).
      if (variant === 'alt' && altTitle) {
        try {
          const h1 = document.querySelector('.p-hero-title');
          if (h1 && h1.textContent !== altTitle) h1.textContent = altTitle;
        } catch {
          /* DOM erişilemezse başlık ana halinde kalır */
        }
      }
    }

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
        body: JSON.stringify({ slug, referrerHost: refHost(), ...(hasAlt ? { v: variant } : {}) }),
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
  }, [slug, altTitle, articleId]);

  return null;
}
