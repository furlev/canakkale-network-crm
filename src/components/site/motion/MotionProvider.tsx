'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';

/**
 * Tüm görsel efektlerin (partikül/WebGL, tilt, cursor, scroll-scrub, reveal) bağlı
 * olduğu TEK karar noktası. Cihaz yeteneği + kullanıcı tercihi + canlı FPS ölçümüne
 * göre 'full | lite | off' tier üretir; sonucu <html data-motion> attribute'una yazar
 * (CSS de okuyabilir). FPS 50'nin altına sürekli inerse otomatik 'lite'a düşer.
 */
export type MotionTier = 'full' | 'lite' | 'off';

const MotionCtx = createContext<MotionTier>('full');
export function useMotionTier(): MotionTier {
  return useContext(MotionCtx);
}

function initialTier(): MotionTier {
  if (typeof window === 'undefined') return 'full';
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return 'lite';
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= 4) return 'lite';
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4) return 'lite';
  } catch {
    /* yoksay */
  }
  return 'full';
}

export default function MotionProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<MotionTier>('full');
  const raf = useRef(0);

  useEffect(() => {
    const start = initialTier();
    setTier(start);
    document.documentElement.setAttribute('data-motion', start);

    // reduced-motion canlı değişimini dinle
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => {
      if (mq.matches) {
        setTier('off');
        document.documentElement.setAttribute('data-motion', 'off');
      }
    };
    mq.addEventListener?.('change', onMq);

    // FPS örnekleme — yalnızca 'off' değilse. 5sn pencere; düşükse lite'a indir.
    let cancelled = false;
    if (start !== 'off') {
      let frames = 0;
      let t0 = performance.now();
      let downgraded = start === 'lite';
      const loop = (t: number) => {
        if (cancelled) return;
        frames++;
        if (t - t0 >= 5000) {
          const fps = (frames * 1000) / (t - t0);
          frames = 0;
          t0 = t;
          if (!downgraded && fps < 50) {
            downgraded = true;
            setTier('lite');
            document.documentElement.setAttribute('data-motion', 'lite');
          }
        }
        raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current);
      mq.removeEventListener?.('change', onMq);
    };
  }, []);

  return <MotionCtx.Provider value={tier}>{children}</MotionCtx.Provider>;
}
