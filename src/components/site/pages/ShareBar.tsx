'use client';

import { useEffect, useRef, useState } from 'react';

/** Haber paylaşım çubuğu: X, Facebook, WhatsApp ve bağlantı kopyalama. */
export default function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard reddedilirse eski yöntem
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="p-share">
      <span className="p-share-label">Paylaş</span>
      <a
        className="p-share-btn"
        href={`https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X'te paylaş"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" /></svg>
        X
      </a>
      <a
        className="p-share-btn"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Facebook'ta paylaş"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.92 3.78-3.92 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" /></svg>
        Facebook
      </a>
      <a
        className="p-share-btn"
        href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp'ta paylaş"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2.05 22l5.3-1.39a9.87 9.87 0 0 0 4.69 1.19h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.13-2.9-7A9.83 9.83 0 0 0 12.04 2Zm5.83 14.12c-.25.7-1.45 1.34-2 1.39-.54.05-1.05.24-3.53-.74-2.99-1.18-4.88-4.23-5.03-4.43-.14-.2-1.19-1.59-1.19-3.03s.75-2.15 1.02-2.44c.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.25.58.83 2.02.9 2.17.07.14.12.31.02.51-.09.2-.14.32-.28.49-.14.17-.3.38-.42.51-.14.14-.29.29-.13.57.17.29.74 1.22 1.59 1.98 1.09.97 2 1.27 2.29 1.42.28.14.45.12.61-.07.17-.19.71-.82.9-1.11.19-.29.38-.24.63-.14.26.09 1.63.77 1.91.91.28.14.47.21.54.32.06.12.06.7-.19 1.4Z" /></svg>
        WhatsApp
      </a>
      <button type="button" className={`p-share-btn ${copied ? 'copied' : ''}`} onClick={copy} aria-label="Bağlantıyı kopyala">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.4-3.4a3 3 0 0 1 4.24 4.24l-1.7 1.7a1 1 0 1 1-1.42-1.41l1.7-1.7a1 1 0 0 0-1.41-1.42l-3.4 3.4a1 1 0 0 1-1.41 0Zm2.8-2.8a1 1 0 0 1 0 1.4l-3.4 3.4a3 3 0 0 1-4.24-4.24l1.7-1.7a1 1 0 0 1 1.42 1.41l-1.7 1.7a1 1 0 0 0 1.41 1.42l3.4-3.4a1 1 0 0 1 1.41 0Z" transform="rotate(45 12 12)" /></svg>
        {copied ? 'Kopyalandı ✓' : 'Kopyala'}
      </button>
    </div>
  );
}
