'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Öğe görünür alana girdiğinde bir kez true olur.
 * IntersectionObserver + güvenlik ağı: IO tetiklenmese bile (arka plan sekmesi,
 * kare üretimi duran renderer, eski tarayıcı) kısa aralıklı bir rect kontrolü
 * görünürlüğü yakalar. Haber sitesinde içerik asla JS'e rehin kalmamalı.
 */
export default function useInViewOnce(ref: RefObject<HTMLElement | null>, topRatio = 1): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    const check = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * topRatio && r.bottom > 0;
    };
    if (check()) {
      setInView(true);
      return;
    }

    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) setInView(true);
      }, { threshold: 0.1 });
      io.observe(el);
    }
    const onScroll = () => { if (check()) setInView(true); };
    window.addEventListener('scroll', onScroll, { passive: true });
    const timer = window.setInterval(onScroll, 900);

    return () => {
      io?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.clearInterval(timer);
    };
  }, [ref, inView, topRatio]);

  return inView;
}
