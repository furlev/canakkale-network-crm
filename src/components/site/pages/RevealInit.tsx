'use client';

import { useEffect } from 'react';

/**
 * .s-reveal öğelerini görünür olduklarında .is-visible ile açar.
 * Layout'taki genel gözlemciyle çakışmaz (classList.add idempotenttir);
 * alt sayfaların tek başına da doğru render olmasını garanti eder.
 *
 * Sekmeye dönüş / bfcache güvenliği: sayfa yeniden görünür olduğunda viewport
 * içindeki öğeler .reveal-instant ile anında tamamlanmış duruma oturur
 * (layout'taki Reveal ile aynı sözleşme; site.css .reveal-instant).
 */
export default function RevealInit() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.s-reveal:not(.is-visible)'));

    // Sekmeye dönüş / bfcache: takılı reveal'ları anında tamamla
    const revive = () => {
      document.querySelectorAll<HTMLElement>('.s-reveal').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add('reveal-instant', 'is-visible');
        }
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') revive();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) revive();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);

    let io: IntersectionObserver | null = null;
    if (els.length > 0) {
      if (typeof IntersectionObserver === 'undefined') {
        els.forEach(el => el.classList.add('is-visible'));
      } else {
        io = new IntersectionObserver(
          entries => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                io?.unobserve(entry.target);
              }
            }
          },
          { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
        );
        els.forEach(el => io?.observe(el));
      }
    }

    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  return null;
}
