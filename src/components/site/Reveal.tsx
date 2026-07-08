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
    // JS çalışıyor işareti: CSS reveal gating'i (html:not(.js-ready)) devreye alır.
    // Script hiç yüklenmezse bu asla eklenmez ve içerik görünür kalır.
    document.documentElement.classList.add('js-ready');

    const revealIfInView = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.96 && r.bottom > -40) {
        el.classList.add('is-visible');
        return true;
      }
      return false;
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

    // Kademeli (stagger) yardımcısı: [data-reveal-stagger] kabındaki doğrudan
    // .s-reveal çocuklarına sıra numarasına göre --reveal-delay atar (yalnızca
    // açıkça ayarlanmamışsa). ArticleCard gibi delay'i kendi veren öğeler korunur.
    const applyStagger = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach(group => {
        const step = parseInt(group.getAttribute('data-reveal-stagger') || '', 10) || 80;
        group
          .querySelectorAll<HTMLElement>(':scope > .s-reveal')
          .forEach((kid, i) => {
            if (!kid.style.getPropertyValue('--reveal-delay')) {
              kid.style.setProperty('--reveal-delay', `${i * step}ms`);
            }
          });
      });
    };

    // Tek öğe: zaten görünürse anında aç, değilse gözle.
    const process = (el: HTMLElement) => {
      if (el.classList.contains('is-visible')) return;
      if (!revealIfInView(el) && io) io.observe(el);
    };

    // İlk geçiş: önce stagger delay'lerini yaz, sonra tüm .s-reveal öğelerini işle.
    applyStagger();
    document
      .querySelectorAll<HTMLElement>('.s-reveal:not(.is-visible)')
      .forEach(process);

    // Güvenlik ağı 1 — scroll: IO hiç tetiklenmese bile (arka plan sekmesi,
    // kare üretmeyen renderer) kaydırmada görünürleri yakala.
    let scrollTick = false;
    const sweepVisible = () => {
      document
        .querySelectorAll<HTMLElement>('.s-reveal:not(.is-visible)')
        .forEach(revealIfInView);
    };
    const onScroll = () => {
      if (scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(() => { scrollTick = false; sweepVisible(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Güvenlik ağı 2 — seyrek süpürme: 1200ms yerine 2500ms, ve her şey
    // görünür olunca kendini durdurur (kalıcı sık çalışma yok).
    const timer = window.setInterval(() => {
      const remaining = document.querySelectorAll<HTMLElement>('.s-reveal:not(.is-visible)');
      if (remaining.length === 0) { window.clearInterval(timer); return; }
      remaining.forEach(revealIfInView);
    }, 2500);

    // Sonradan eklenen .s-reveal öğeleri: TÜM belgeyi süpürmek yerine yalnızca
    // eklenen node'ları tara ve rAF ile toplu işle (her mutasyonda çalışma yok).
    let moScheduled = false;
    const pending = new Set<HTMLElement>();
    const flush = () => {
      moScheduled = false;
      const batch = Array.from(pending);
      pending.clear();
      applyStagger();
      batch.forEach(process);
    };
    const mo = new MutationObserver(records => {
      for (const rec of records) {
        rec.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.classList.contains('s-reveal')) pending.add(node);
          node
            .querySelectorAll<HTMLElement>('.s-reveal:not(.is-visible)')
            .forEach(el => pending.add(el));
        });
      }
      if (pending.size > 0 && !moScheduled) {
        moScheduled = true;
        requestAnimationFrame(flush);
      }
    });
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
