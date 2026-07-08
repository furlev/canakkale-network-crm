'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useMotionTier } from '@/components/site/motion/MotionProvider';

/**
 * Manyetik çekim: işaretçi öğeye (ve `padding` kadar çevresine) yaklaştıkça öğe
 * işaretçiye doğru hafifçe kayar. Sonuç `--mag-x` / `--mag-y` (px) custom
 * property'lerine yazılır (React state YOK → re-render yok). İşaretçi uzaklaşınca
 * yumuşakça 0'a döner (geçiş CSS'te).
 *
 * YALNIZCA `pointer: fine` + motion tier `full` iken etkindir; aksi halde sessizdir
 * ve buton normal davranır (custom property 0'da kalır).
 */
export function useMagnetic<T extends HTMLElement = HTMLElement>(options?: {
  strength?: number;
  padding?: number;
  disabled?: boolean;
}): RefObject<T | null> {
  const { strength = 0.35, padding = 24, disabled = false } = options ?? {};
  const ref = useRef<T | null>(null);
  const tier = useMotionTier();

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled || tier !== 'full') return;
    if (!window.matchMedia?.('(pointer: fine)').matches) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;

    const apply = () => {
      raf = 0;
      el.style.setProperty('--mag-x', `${tx.toFixed(2)}px`);
      el.style.setProperty('--mag-y', `${ty.toFixed(2)}px`);
    };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // Etki alanı: öğe + padding. Dışındaysa çekim uygulama.
      if (
        e.clientX < rect.left - padding ||
        e.clientX > rect.right + padding ||
        e.clientY < rect.top - padding ||
        e.clientY > rect.bottom + padding
      ) {
        tx = 0;
        ty = 0;
      } else {
        tx = dx * strength;
        ty = dy * strength;
      }
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const reset = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      tx = 0;
      ty = 0;
      el.style.setProperty('--mag-x', '0px');
      el.style.setProperty('--mag-y', '0px');
    };

    // İşaretçi butona uzaktan yaklaşabildiği için hareketi pencerede dinleriz.
    window.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', reset);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
      reset();
    };
  }, [strength, padding, disabled, tier]);

  return ref;
}

export default useMagnetic;
