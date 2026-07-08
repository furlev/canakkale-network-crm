'use client';

import { useEffect, useRef } from 'react';

/** Sayfanın üstünde ince kızıl okuma ilerleme çubuğu. */
export default function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const ratio = max > 0 ? Math.min(1, el.scrollTop / max) : 0;
      if (barRef.current) barRef.current.style.width = `${(ratio * 100).toFixed(2)}%`;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={barRef} className="p-progress s-progress" aria-hidden="true" />;
}
