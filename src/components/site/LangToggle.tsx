'use client';

import { useEffect, useState } from 'react';

/**
 * TR/EN dil anahtarı — i18n İSKELE (W3-C).
 *
 * NOT: İçerik çevirisi henüz KAPSAM DIŞI. Bu bileşen yalnızca kullanıcının dil
 * tercihini `localStorage['site-lang']` içinde saklar ve <html lang> özniteliğini
 * günceller. Gerçek çeviri altyapısı (sözlük + `/en` rotası) devreye girince bu
 * toggle o rotaya yönlendirilecek. Şu an header'a bağlı DEĞİL — opsiyonel iskele.
 *
 * Header'a eklemek için (ileride): SiteHeader içine `<LangToggle />` yerleştir.
 */
export default function LangToggle() {
  const [lang, setLang] = useState<'tr' | 'en'>('tr');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('site-lang');
      if (saved === 'en') {
        setLang('en');
        document.documentElement.setAttribute('lang', 'en');
      }
    } catch {
      /* gizli modda localStorage olmayabilir */
    }
  }, []);

  const pick = (next: 'tr' | 'en') => {
    setLang(next);
    document.documentElement.setAttribute('lang', next);
    try {
      localStorage.setItem('site-lang', next);
    } catch {
      /* yok say */
    }
  };

  return (
    <div
      className="lang-toggle"
      role="group"
      aria-label="Dil seçimi / Language"
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.15)',
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {(['tr', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => pick(code)}
          aria-pressed={lang === code}
          title={code === 'tr' ? 'Türkçe' : 'English (yakında)'}
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            textTransform: 'uppercase',
            background: lang === code ? 'rgba(255,255,255,0.9)' : 'transparent',
            color: lang === code ? '#0a0a0f' : 'inherit',
            transition: 'background 0.15s ease',
          }}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
