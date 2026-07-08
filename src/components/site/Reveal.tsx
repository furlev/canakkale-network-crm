'use client';

import { useEffect } from 'react';

/**
 * Sayfadaki tüm .s-reveal öğelerini görünür olduklarında .is-visible ile açar.
 * Birincil yol IntersectionObserver'dır; ancak IO'nun hiç tetiklenmediği
 * durumlar için (arka plan sekmesi, kare üretmeyen renderer, egzotik tarayıcı)
 * scroll dinleyicisi + kısa aralıklı süpürme güvenlik ağı vardır.
 * Haber sitesinde içerik hiçbir koşulda gizli kalmamalı.
 */
export default function Reveal() {
  useEffect(() => {
    const revealIfInView = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.96 && r.bottom > -40) {
        el.classList.add('is-visible');
        return true;
      }
      return false;
    };

    const sweep = () => {
      document
        .querySelectorAll<HTMLElement>('.s-reveal:not(.is-visible)')
        .forEach(revealIfInView);
    };

    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              io?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.08, rootMargin: '0px 0px -6% 0px' }
      );
    }

    const observeNew = () => {
      document
        .querySelectorAll<HTMLElement>('.s-reveal:not(.is-visible)')
        .forEach(el => io?.observe(el)); // aynı öğeyi tekrar observe etmek zararsızdır
    };

    // İlk geçiş: görünürdekileri anında aç, kalanını gözle
    sweep();
    observeNew();

    // Güvenlik ağı: scroll + periyodik süpürme (IO çalışıyorsa neredeyse hep boş geçer)
    let scrollTick = false;
    const onScroll = () => {
      if (scrollTick) return;
      scrollTick = true;
      setTimeout(() => { scrollTick = false; sweep(); }, 120);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const timer = window.setInterval(sweep, 1200);

    // Client tarafında sonradan eklenen .s-reveal öğeleri için hafif bir gözcü
    const mo = new MutationObserver(() => { sweep(); observeNew(); });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io?.disconnect();
      mo.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
