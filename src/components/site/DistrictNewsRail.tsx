'use client';

import { useEffect, useState } from 'react';
import ArticleCard, { type ArticleCardData } from './ArticleCard';
import { districtName } from '@/lib/districts';
import styles from './DistrictNewsRail.module.css';

/**
 * "İlçenden Haberler" rayı — ziyaretçinin "Benim İlçem" tercihine göre (localStorage
 * 'cn-district') seçili ilçenin son haberlerini gösterir. Tercih yoksa hiç render
 * OLMAZ (null). DistrictPref seçim değiştirdiğinde 'cn:district' CustomEvent'ini
 * dinleyip canlı güncellenir.
 *
 * Veriyi public uçtan çeker: GET /api/site/articles?ilce=<slug>&take=8 (oturum gerekmez).
 * Saf istemci; ilçe listesi foundation DISTRICTS'ten gelir (prisma'ya bağlı değil).
 */

const STORAGE_KEY = 'cn-district';

export default function DistrictNewsRail() {
  const [slug, setSlug] = useState('');
  const [items, setItems] = useState<ArticleCardData[] | null>(null);

  // İlk yükleme + tercih değişimini dinle
  useEffect(() => {
    try {
      setSlug(localStorage.getItem(STORAGE_KEY) || '');
    } catch {
      /* gizli mod */
    }
    const onPref = (e: Event) => {
      const detail = (e as CustomEvent<{ slug: string }>).detail;
      setSlug(detail?.slug || '');
    };
    window.addEventListener('cn:district', onPref as EventListener);
    return () => window.removeEventListener('cn:district', onPref as EventListener);
  }, []);

  // Seçili ilçe için haberleri çek
  useEffect(() => {
    if (!slug) {
      setItems(null);
      return;
    }
    let cancelled = false;
    setItems(null);
    (async () => {
      try {
        const res = await fetch(`/api/site/articles?ilce=${encodeURIComponent(slug)}&take=8`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { items?: ArticleCardData[] };
        if (!cancelled) setItems(Array.isArray(json.items) ? json.items : []);
      } catch {
        /* ağ hatası — sessizce gizli kal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Seçim yoksa ya da haber yoksa hiç gösterme
  if (!slug || !items || items.length === 0) return null;

  const name = districtName(slug) || 'İlçen';

  return (
    <section className={`s-section ${styles.rail}`} aria-label={`${name} haberleri`}>
      <div className="s-container">
        <div className="s-section-head s-reveal">
          <div>
            <span className="s-kicker">Benim İlçem</span>
            <h2 className="s-section-title">
              {name}
              <span className="tick">&apos;den</span> Haberler
            </h2>
          </div>
          <a href={`/ilce/${slug}`} className={styles.all}>
            Tümü
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </a>
        </div>
        <div className="home-grid">
          {items.map((a, i) => (
            <ArticleCard key={a.slug} article={a} revealDelay={Math.min(i * 60, 480)} />
          ))}
        </div>
      </div>
    </section>
  );
}
