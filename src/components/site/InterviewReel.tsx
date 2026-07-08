import Link from 'next/link';
import type { CSSProperties } from 'react';
import { formatDateTr } from '@/lib/site';

export type ReelItem = {
  id: string;
  slug: string;
  title: string;
  imageAlt: string | null;
  videoUrl: string | null;
  publishedAt: Date | string | null;
};

/**
 * "Sokak Röportajları" — sinematik 16:9 kartlar; videosu olanlarda kızıl play rozeti.
 * Sunucu bileşenidir; hover parlaması ve reveal CSS ile çalışır.
 */
export default function InterviewReel({ articles }: { articles: ReelItem[] }) {
  if (articles.length === 0) return null;
  return (
    <section className="s-section reel-section">
      <div className="s-container">
        <div className="s-section-head s-reveal">
          <div>
            <span className="s-kicker">Kamera Sokakta</span>
            <h2 className="s-section-title">
              Sokak <span className="tick">Röportajları</span>
            </h2>
          </div>
          <Link href="/kategori/roportajlar" className="rail-all">
            Tümü <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="reel-grid">
          {articles.map((a, i) => (
            <Link
              key={a.slug}
              href={`/haber/${a.slug}`}
              className="reel-card s-reveal"
              style={{ '--reveal-delay': `${Math.min(i * 90, 450)}ms` } as CSSProperties}
            >
              <div className="reel-media">
                {/* Görsel /img/[id] endpoint'inden gelir (data-URI HTML'e gömülmez) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/img/${a.id}`} alt={a.imageAlt || a.title} loading="lazy" decoding="async" />
                {a.videoUrl && (
                  <span className="reel-play" aria-label="Video içerik">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="reel-overlay">
                <h3 className="reel-title">{a.title}</h3>
                {a.publishedAt && <span className="reel-date">{formatDateTr(a.publishedAt)}</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
