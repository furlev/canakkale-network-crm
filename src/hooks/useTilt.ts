'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useMotionTier } from '@/components/site/motion/MotionProvider';

/**
 * İşaretçiye göre 3B eğim (tilt) davranışı. Öğeye pointermove dinler ve şu CSS custom
 * property'leri yazar (React state YOK → re-render yok):
 *   --tilt-rx / --tilt-ry : rotateX / rotateY (derece)
 *   --tilt-px / --tilt-py : normalize işaretçi ofseti [-1,1] (görsel parallax için)
 *   --tilt-mx / --tilt-my : işaretçinin öğe içi konumu (%), gloss merkezi için
 * İşaretçi öğedeyken `data-tilt="active"` set edilir (CSS geçiş süresini kısaltmak için).
 *
 * YALNIZCA `pointer: fine` (gerçek fare) + motion tier `full` iken etkindir; aksi halde
 * hiçbir şey bağlanmaz ve custom property'ler varsayılanında (identity) kalır → mevcut
 * hover davranışı korunur. Dokunmatik/azaltılmış-hareket cihazlarda tamamen sessizdir.
 */
export function useTilt<T extends HTMLElement = HTMLElement>(options?: {
  max?: number;
  disabled?: boolean;
}): RefObject<T | null> {
  const { max = 4, disabled = false } = options ?? {};
  const ref = useRef<T | null>(null);
  const tier = useMotionTier();

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled || tier !== 'full') return;
    // Kaba işaretçili (dokunmatik) cihazlarda tilt yok.
    if (!window.matchMedia?.('(pointer: fine)').matches) return;

    let raf = 0;
    let px = 0;
    let py = 0;
    let mx = 50;
    let my = 50;

    const apply = () => {
      raf = 0;
      el.style.setProperty('--tilt-rx', `${(-py * max).toFixed(2)}deg`);
      el.style.setProperty('--tilt-ry', `${(px * max).toFixed(2)}deg`);
      el.style.setProperty('--tilt-px', px.toFixed(3));
      el.style.setProperty('--tilt-py', py.toFixed(3));
      el.style.setProperty('--tilt-mx', `${mx.toFixed(1)}%`);
      el.style.setProperty('--tilt-my', `${my.toFixed(1)}%`);
    };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const rx = (e.clientX - rect.left) / rect.width; // 0..1
      const ry = (e.clientY - rect.top) / rect.height; // 0..1
      px = rx * 2 - 1; // -1..1
      py = ry * 2 - 1;
      mx = rx * 100;
      my = ry * 100;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onEnter = () => {
      el.dataset.tilt = 'active';
    };

    const reset = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      delete el.dataset.tilt;
      el.style.setProperty('--tilt-rx', '0deg');
      el.style.setProperty('--tilt-ry', '0deg');
      el.style.setProperty('--tilt-px', '0');
      el.style.setProperty('--tilt-py', '0');
      el.style.setProperty('--tilt-mx', '50%');
      el.style.setProperty('--tilt-my', '50%');
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
    el.addEventListener('pointercancel', reset);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
      el.removeEventListener('pointercancel', reset);
      reset();
    };
  }, [max, disabled, tier]);

  return ref;
}

export default useTilt;
