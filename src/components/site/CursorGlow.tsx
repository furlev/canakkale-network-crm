'use client';

import { useEffect, useRef } from 'react';
import { useMotionTier } from './motion/MotionProvider';
import styles from './CursorGlow.module.css';

/**
 * İmleç aurası: işaretçiyi izleyen yumuşak marka-renkli kor parıltısı (screen blend).
 * YALNIZCA pointer:fine + motion tier full iken etkinleşir; dokunmatik / azaltılmış
 * hareket / lite-off cihazlarda görünmez ve dinleyici bağlamaz. pointer-events yok.
 *
 * Global mount gerekir (layout'a bir kez eklenir).
 */
export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const tier = useMotionTier();

  useEffect(() => {
    const el = ref.current;
    if (!el || tier !== 'full') return;
    if (!window.matchMedia?.('(pointer: fine)').matches) return;

    let raf = 0;
    let x = 0;
    let y = 0;
    let shown = false;

    const apply = () => {
      raf = 0;
      el.style.setProperty('--cx', `${x}px`);
      el.style.setProperty('--cy', `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!shown) {
        shown = true;
        el.classList.add(styles.visible);
      }
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      shown = false;
      el.classList.remove(styles.visible);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [tier]);

  return <div ref={ref} className={styles.glow} aria-hidden="true" />;
}
