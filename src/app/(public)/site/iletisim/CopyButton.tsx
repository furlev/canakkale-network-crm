'use client';

import { useRef, useState } from 'react';

/**
 * Küçük "kopyala" butonu — e-posta adreslerini tek tıkla panoya alır.
 * Pano erişimi yoksa (eski tarayıcı / izin) sessizce hiçbir şey yapmaz.
 */
export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano API'si engellendiyse buton işlevsiz kalır; adres zaten görünür.
    }
  };

  return (
    <button
      type="button"
      className={`p-copy-btn${copied ? ' copied' : ''}`}
      onClick={copy}
      aria-live="polite"
      aria-label={copied ? 'Adres kopyalandı' : `${text} adresini kopyala`}
    >
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Kopyalandı
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Kopyala
        </>
      )}
    </button>
  );
}
