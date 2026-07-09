'use client';

import { useEffect, useState } from 'react';
import ArticleCard, { type ArticleCardData } from './ArticleCard';
import styles from './VideoReel.module.css';

/**
 * "Video Haber" rayı — videoUrl'ü dolu son yayınları yatay bir şeritte gösterir.
 * Veriyi public uçtan çeker: GET /api/site/videos?take=10 (oturum gerekmez).
 * Hiç video haber yoksa render OLMAZ (null) → build/anasayfa kırılmaz.
 *
 * Saf istemci; server veri geçmeye gerek yok, böylece (public)/site/page.tsx'e
 * yalnızca <VideoReel /> mount'u yeterli.
 */
export default function VideoReel({ take = 10 }: { take?: number }) {
  const [items, setItems] = useState<ArticleCardData[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/site/videos?take=${encodeURIComponent(String(take))}`, {
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
  }, [take]);

  // Veri gelmeden ya da hiç video haber yoksa gösterme
  if (!items || items.length === 0) return null;

  return (
    <section className={`s-section ${styles.reel}`} aria-label="Video haberler">
      <div className="s-container">
        <div className="s-section-head s-reveal">
          <div>
            <span className="s-kicker">İzle</span>
            <h2 className="s-section-title">
              Video<span className="tick"> Haber</span>
            </h2>
          </div>
        </div>
        <ul className={styles.track}>
          {items.map((a, i) => (
            <li key={a.slug} className={styles.slide}>
              <ArticleCard article={{ ...a, hasVideo: true }} revealDelay={Math.min(i * 60, 480)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
