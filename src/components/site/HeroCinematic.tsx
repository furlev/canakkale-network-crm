'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import ParticleField from './ParticleField';

export type HeroItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  imageAlt: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  /** Sunucuda formatDateTr ile hazırlanmış tarih etiketi */
  dateLabel: string;
};

const ROTATE_MS = 6000;

/**
 * ~92vh sinematik manşet: Ken Burns arka plan, kor parçacıkları, kelime kelime
 * başlık reveal'ı ve 6 sn'de bir dönen 01–05 mini manşet listesi.
 */
export default function HeroCinematic({ items }: { items: HeroItem[] }) {
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0); // manuel seçimde sayaç sıfırlansın diye
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (items.length < 2 || reducedRef.current) return;
    const id = setInterval(() => setActive(a => (a + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length, cycle]);

  const select = (i: number) => {
    setActive(i);
    setCycle(c => c + 1);
  };

  // ── DB boşken zarif fallback: marka videosu + slogan ──
  if (items.length === 0) {
    return (
      <section className="hero hero-fallback" aria-label="Çanakkale Network">
        <video
          className="hero-brand-video"
          src="/site/brand.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className="hero-veil" aria-hidden="true" />
        <ParticleField />
        <div className="s-container hero-fallback-inner">
          <img src="/site/logo-dark.png" alt="Çanakkale Network" className="hero-fallback-logo" />
          <h1 className="hero-fallback-title">Şehrin Dijital Meydanı</h1>
          <p className="hero-spot">İlk haberler yolda — Çanakkale&apos;nin nabzı çok yakında burada atacak.</p>
        </div>
      </section>
    );
  }

  const current = items[active];

  return (
    <section className="hero" aria-label="Manşet haberler">
      <div className="hero-bg-stack" aria-hidden="true">
        {items.map((item, i) => {
          const isActive = i === active;
          // PERF: yalnızca aktif ve bir sonraki manşetin görselini DOM'a bas;
          // diğerleri <img> olarak durmasın (5 base64/uzak görsel yerine en fazla 2).
          const isNext = items.length > 1 && i === (active + 1) % items.length;
          return (
            <div key={item.slug} className={`hero-bg${isActive ? ' is-active' : ''}`}>
              {isActive || isNext ? (
                // Görsel /img/[id] endpoint'inden gelir (data-URI HTML'e gömülmez)
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/img/${item.id}`}
                  alt=""
                  decoding="async"
                  fetchPriority={isActive ? 'high' : 'auto'}
                  loading={isActive ? 'eager' : 'lazy'}
                />
              ) : (
                <div className="hero-bg-brand" />
              )}
            </div>
          );
        })}
      </div>
      <div className="hero-veil" aria-hidden="true" />
      <ParticleField />

      <div className="s-container hero-layout">
        {/* key=slug → her manşet değişiminde içerik animasyonları yeniden oynar */}
        <div className="hero-content" key={current.slug}>
          <div className="hero-meta">
            {current.categoryName && current.categorySlug && (
              <Link href={`/kategori/${current.categorySlug}`} className="s-badge s-badge-cat hero-badge">
                {current.categoryName}
              </Link>
            )}
            <span className="hero-date">{current.dateLabel}</span>
          </div>
          <h1 className="hero-title">
            {current.title.split(/\s+/).map((word, i) => (
              <Fragment key={`${i}-${word}`}>
                <span
                  className="hero-word"
                  style={{ animationDelay: `${Math.min(i * 70, 900)}ms` }}
                >
                  {word}
                </span>{' '}
              </Fragment>
            ))}
          </h1>
          {current.summary && <p className="hero-spot">{current.summary}</p>}
          <Link href={`/haber/${current.slug}`} className="s-btn s-btn-primary hero-cta">
            Haberi Oku
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </Link>
        </div>

        <ol className="hero-list" aria-label="Öne çıkan haberler">
          {items.map((item, i) => (
            <li key={item.slug}>
              <button
                type="button"
                className={`hero-list-item${i === active ? ' is-active' : ''}`}
                onClick={() => select(i)}
                aria-current={i === active ? 'true' : undefined}
                aria-label={`Manşet ${i + 1}: ${item.title}`}
              >
                <span className="hero-list-no" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="hero-list-title">{item.title}</span>
                {i === active && (
                  <span key={`p-${cycle}-${active}`} className="hero-progress" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="hero-scroll" aria-hidden="true">
        <span className="hero-mouse">
          <span className="hero-wheel" />
        </span>
        <span className="hero-scroll-text">Kaydır</span>
      </div>
    </section>
  );
}
