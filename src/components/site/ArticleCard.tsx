import Link from 'next/link';
import { formatDateTr } from '@/lib/site';

/** Kart bileşeninin beklediği hafif makale özeti (SiteArticle alt kümesi). */
export type ArticleCardData = {
  slug: string;
  title: string;
  summary?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageIsAi?: boolean;
  categorySlug?: string | null;
  categoryName?: string | null;
  isBreaking?: boolean;
  publishedAt?: Date | string | null;
  views?: number;
  authorName?: string | null;
};

/**
 * Site genelinde ortak haber kartı.
 * variant: 'default' dikey kart, 'row' kompakt yatay kart (yan sütunlar).
 */
export default function ArticleCard({
  article,
  variant = 'default',
  revealDelay,
}: {
  article: ArticleCardData;
  variant?: 'default' | 'row';
  revealDelay?: number;
}) {
  const a = article;
  return (
    <Link
      href={`/haber/${a.slug}`}
      className={`s-card s-reveal ${variant === 'row' ? 's-card-row' : ''}`}
      style={revealDelay ? ({ '--reveal-delay': `${revealDelay}ms` } as React.CSSProperties) : undefined}
    >
      <div className="s-card-media">
        {a.imageUrl ? (
          // data URI'ler ve dış görseller için düz img (next/image unoptimized zaten)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.imageUrl} alt={a.imageAlt || a.title} loading="lazy" />
        ) : (
          <img src="/site/logo-dark.png" alt="" loading="lazy" style={{ objectFit: 'contain', padding: '18%', opacity: 0.5 }} />
        )}
        {a.isBreaking ? (
          <span className="s-badge s-badge-breaking">Son Dakika</span>
        ) : a.categoryName ? (
          <span className="s-badge s-badge-cat">{a.categoryName}</span>
        ) : null}
      </div>
      <div className="s-card-body">
        <h3 className="s-card-title">{a.title}</h3>
        {a.summary && <p className="s-card-summary">{a.summary}</p>}
        <div className="s-card-meta">
          {a.publishedAt && <span>{formatDateTr(a.publishedAt)}</span>}
          {typeof a.views === 'number' && a.views > 0 && (
            <>
              <span className="dot" />
              <span>{a.views.toLocaleString('tr-TR')} görüntülenme</span>
            </>
          )}
          {a.imageIsAi && (
            <>
              <span className="dot" />
              <span className="s-badge s-badge-ai" style={{ padding: '2px 8px' }}>Temsili görsel</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
