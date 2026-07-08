'use client';

import { useEffect } from 'react';

/**
 * .s-reveal öğelerini görünür olduklarında .is-visible ile açar.
 * Layout'taki genel gözlemciyle çakışmaz (classList.add idempotenttir);
 * alt sayfaların tek başına da doğru render olmasını garanti eder.
 */
export default function RevealInit() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.s-reveal:not(.is-visible)'));
    if (els.length === 0) return;

    if (typeof IntersectionObserver === 'undefined') {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );

    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
