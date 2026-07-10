'use client';

import { useEffect, useState } from 'react';

/**
 * Çift kimlik tema anahtarı: ☾ Network (koyu) ⇄ ☀ Truva (aydınlık).
 * Görsel durum tamamen html[data-site-theme] üzerinden CSS ile sürülür,
 * böylece hydration öncesi/sonrası hiçbir titreme olmaz.
 *
 * Geçiş efekti: document.startViewTransition destekleyen tarayıcıda tıklama
 * noktasından dairesel açılma (clip-path circle, ::view-transition-new(root));
 * desteklemeyende kökte ~350ms renk geçişi. prefers-reduced-motion'da efekt yok.
 * localStorage('site-theme') + layout.tsx head'deki FOUC script'i aynen çalışır.
 */

type ViewTransitionLike = { ready: Promise<void>; finished: Promise<void> };
type DocumentWithVT = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionLike;
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'network' | 'truva'>('network');

  useEffect(() => {
    if (document.documentElement.getAttribute('data-site-theme') === 'truva') {
      setTheme('truva');
    }
  }, []);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = theme === 'network' ? 'truva' : 'network';
    const root = document.documentElement;

    const apply = () => {
      setTheme(next);
      root.setAttribute('data-site-theme', next);
      try {
        localStorage.setItem('site-theme', next);
      } catch {
        /* gizli modda localStorage olmayabilir */
      }
    };

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const doc = document as DocumentWithVT;

    // Azaltılmış hareket ya da destek yok → animasyonsuz / yumuşak renk geçişi
    if (reduced || typeof doc.startViewTransition !== 'function') {
      root.classList.add('theme-fading'); // reduced-motion'da CSS geçişi kapatır
      apply();
      window.setTimeout(() => root.classList.remove('theme-fading'), 380);
      return;
    }

    // Dairesel açılma: merkez tıklama noktası (klavyeyle tetiklemede buton merkezi)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX || rect.left + rect.width / 2;
    const y = e.clientY || rect.top + rect.height / 2;
    const maxR = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    // .theme-vt: varsayılan çapraz-solma yalnız TEMA geçişinde kapatılır
    // (Next'in kendi rota view transition'ları etkilenmesin)
    root.classList.add('theme-vt');
    const vt = doc.startViewTransition(apply);
    vt.ready
      .then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${Math.ceil(maxR)}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 480,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          },
        );
      })
      .catch(() => {
        /* geçiş iptal olabilir (hızlı ardışık tık) — tema yine uygulanmıştır */
      });
    vt.finished.finally(() => root.classList.remove('theme-vt'));
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'network' ? 'Aydınlık temaya geç (Truva)' : 'Koyu temaya geç (Network)'}
      title={theme === 'network' ? 'Truva teması (aydınlık)' : 'Network teması (koyu)'}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        {/* Güneş — Truva (aydınlık) */}
        <span className="theme-toggle-icon theme-icon-truva">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
            <path d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
          </svg>
        </span>
        {/* Ay — Network (koyu) */}
        <span className="theme-toggle-icon theme-icon-network">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.6 14.5A8.6 8.6 0 0 1 9.5 3.4 8.6 8.6 0 1 0 20.6 14.5Z" />
          </svg>
        </span>
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}
