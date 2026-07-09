'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Lightbox.module.css';

/** Galeri görseli — dış (harici) http(s) URL + erişilebilir alt metin. */
export type GalleryImage = { url: string; alt: string };

/**
 * Haber detay foto galerisi: küçük görsel ızgarası + tam ekran Lightbox.
 *
 * Lightbox erişilebilirlik:
 *  - role="dialog" aria-modal, açılışta kapat düğmesine odak, kapanışta tetikleyen
 *    öğeye odak geri döner.
 *  - Klavye: ← / → gezinme, Esc kapatma, Tab odak tuzağı (dialog içinde döner).
 *  - Body scroll açıkken kilitlenir.
 *  - Geçişler yalnızca reduced-motion yoksa; aksi anında.
 *
 * images boşsa hiç render OLMAZ (çağıran taraf da kontrol edebilir).
 */
export default function Lightbox({ images, title }: { images: GalleryImage[]; title?: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // Lightbox'ı açan küçük görsel düğmesi — kapanışta odak buraya döner.
  const triggerRef = useRef<HTMLElement | null>(null);

  const count = images.length;

  const openAt = useCallback((i: number, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setIndex(i);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Odağı tetikleyen küçük görsele geri ver (bir sonraki frame'de DOM hazır)
    const t = triggerRef.current;
    if (t) requestAnimationFrame(() => t.focus());
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => setIndex(i => (count ? (i + dir + count) % count : 0)),
    [count]
  );

  // Açıkken: body scroll kilidi + kapat düğmesine odak
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusId = requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(focusId);
    };
  }, [open]);

  // Klavye: Esc / ok tuşları / Tab odak tuzağı
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
        return;
      }
      if (e.key === 'Tab') {
        // Odak tuzağı — dialog içindeki odaklanabilir öğeler arasında döndür
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const activeEl = document.activeElement as HTMLElement | null;
        if (e.shiftKey && activeEl === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [close, go]
  );

  if (count === 0) return null;

  const current = images[index];

  return (
    <section className={styles.gallery} aria-label={title ? `${title} — foto galeri` : 'Foto galeri'}>
      <ul className={styles.grid}>
        {images.map((img, i) => (
          <li key={`${img.url}-${i}`} className={styles.cell}>
            <button
              type="button"
              className={styles.thumb}
              onClick={e => openAt(i, e.currentTarget)}
              aria-label={`${i + 1}. görseli büyüt${img.alt ? `: ${img.alt}` : ''}`}
            >
              {/* Galeri görselleri harici URL'dir; /img/[id] devreye girmez. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt || ''} loading="lazy" decoding="async" />
              <span className={styles.zoom} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Foto galeri görüntüleyici"
          ref={dialogRef}
          onKeyDown={onKeyDown}
          onClick={e => {
            // Zemine (görsel dışına) tıklayınca kapat
            if (e.target === e.currentTarget) close();
          }}
        >
          <button
            type="button"
            ref={closeBtnRef}
            className={`${styles.ctl} ${styles.close}`}
            onClick={close}
            aria-label="Galeriyi kapat"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          {count > 1 && (
            <button
              type="button"
              className={`${styles.ctl} ${styles.prev}`}
              onClick={() => go(-1)}
              aria-label="Önceki görsel"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          )}

          <figure className={styles.stage}>
            {/* key → görsel değişince fade animasyonu yeniden oynar */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={index} src={current.url} alt={current.alt || ''} className={styles.full} decoding="async" />
            {current.alt && <figcaption className={styles.caption}>{current.alt}</figcaption>}
          </figure>

          {count > 1 && (
            <button
              type="button"
              className={`${styles.ctl} ${styles.next}`}
              onClick={() => go(1)}
              aria-label="Sonraki görsel"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          )}

          {count > 1 && (
            <div className={styles.counter} aria-live="polite">
              {index + 1} / {count}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
