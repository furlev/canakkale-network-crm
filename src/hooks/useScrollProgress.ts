'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Bir öğenin görünüm penceresinden yukarı doğru kayış ilerlemesini (0→1) rAF ile
 * ölçer ve her karede `onProgress` çağırır. State tutmaz → re-render yok; sonucu
 * doğrudan CSS custom property'ye yazmak için idealdir (HeroCinematic scroll-scrub
 * fallback'i buna dayanır).
 *
 * İlerleme: `p = (scrollY - elementTop) / (elementHeight * scrub)`, [0,1] aralığına
 * kırpılır. `scrub=1` (varsayılan) → öğe yaklaşık bir kendi boyu kadar kayınca 1'e ulaşır.
 *
 * `disabled` true iken hiçbir dinleyici bağlanmaz (native CSS scroll-timeline yolu
 * devredeyse JS'i uyutmak için). SSR güvenli: tüm erişim useEffect içindedir.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  onProgress: (p: number) => void,
  options?: { disabled?: boolean; scrub?: number }
): void {
  const { disabled = false, scrub = 1 } = options ?? {};
  // Callback'i ref'te tut → tüketicinin useCallback ile sarmasına gerek kalmaz.
  const cb = useRef(onProgress);
  cb.current = onProgress;

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let last = -1;

    const measure = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY; // belge içi mutlak konum
      const h = Math.max(rect.height, 1);
      const raw = (window.scrollY - top) / (h * Math.max(scrub, 0.0001));
      const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      // Aynı değeri tekrar yazma (gereksiz style mutasyonu yok)
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      cb.current(p);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure(); // ilk değeri hemen ver
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref, disabled, scrub]);
}

export default useScrollProgress;
