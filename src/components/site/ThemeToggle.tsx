'use client';

import { useEffect, useState } from 'react';

/**
 * Çift kimlik tema anahtarı: 🌃 Network (koyu) ⇄ 🏛️ Truva (aydınlık).
 * Görsel durum tamamen html[data-site-theme] üzerinden CSS ile sürülür,
 * böylece hydration öncesi/sonrası hiçbir titreme olmaz.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<'network' | 'truva'>('network');

  useEffect(() => {
    if (document.documentElement.getAttribute('data-site-theme') === 'truva') {
      setTheme('truva');
    }
  }, []);

  const toggle = () => {
    const next = theme === 'network' ? 'truva' : 'network';
    setTheme(next);
    document.documentElement.setAttribute('data-site-theme', next);
    try {
      localStorage.setItem('site-theme', next);
    } catch {
      /* gizli modda localStorage olmayabilir */
    }
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
        <span className="theme-toggle-icon theme-icon-truva">🏛️</span>
        <span className="theme-toggle-icon theme-icon-network">🌃</span>
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}
