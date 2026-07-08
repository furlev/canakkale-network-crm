'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/**
 * "Ekibimize Katıl" sinematik bandı — arka planda düşük opaklıkta abide görseli,
 * scroll'a bağlı hafif paralaks (reduced-motion'da kapalı).
 */
export default function JoinCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const section = sectionRef.current;
      const bg = bgRef.current;
      if (!section || !bg) return;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) return; // görünmüyorsa dokunma
      const k = (rect.top + rect.height / 2 - vh / 2) / vh; // ~-1..1
      // CSS'teki -50% dikey ortalamayı koruyarak üzerine px cinsinden paralaks ekler
      bg.style.transform = `translate3d(0, calc(-50% + ${(k * -70).toFixed(1)}px), 0) scale(1.12)`;
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

  return (
    <section className="join-cta" ref={sectionRef}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={bgRef} src="/site/abide.png" alt="" className="join-abide" aria-hidden="true" />
      <div className="join-veil" aria-hidden="true" />
      <div className="s-container join-inner s-reveal">
        <span className="s-kicker join-kicker">Aramıza Katıl</span>
        <h2 className="join-title">
          Şehrin hikâyesini <em>birlikte</em> yazalım.
        </h2>
        <p className="join-sub">
          Muhabirlikten kameraya, tasarımdan sosyal medyaya — Çanakkale Network büyüyor ve seni arıyor.
        </p>
        <Link href="/ekibimize-katil" className="s-btn s-btn-primary join-btn">
          Ekibimize Katıl
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
