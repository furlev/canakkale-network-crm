'use client';

import Link from 'next/link';
import { useTilt } from '@/hooks/useTilt';
import { districtName } from '@/lib/districts';

/** Kart bileşeninin beklediği hafif makale özeti (SiteArticle alt kümesi). */
export type ArticleCardData = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  imageAlt?: string | null;
  imageIsAi?: boolean;
  categorySlug?: string | null;
  categoryName?: string | null;
  isBreaking?: boolean;
  publishedAt?: Date | string | null;
  views?: number;
  authorName?: string | null;
  /** Çanakkale ilçe slug'ı (varsa kartta '📍 İlçe' rozeti gösterilir). */
  district?: string | null;
};

// İstemci-güvenli tarih biçimlendirici. @/lib/site (prisma import eder → sunucuya bağlı)
// bu istemci bileşenine sızmasın diye formatDateTr burada birebir tekrar edilir.
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
function formatDateTr(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Site genelinde ortak haber kartı.
 * variant: 'default' dikey kart, 'row' kompakt yatay kart (yan sütunlar).
 * Hover'da 3B tilt + görsel parallax + gloss (yalnız pointer:fine + motion tier full;
 * useTilt bu koşulları kendi içinde uygular, aksi halde kart klasik hover ile çalışır).
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
  const tiltRef = useTilt<HTMLAnchorElement>({ max: 4 });
  return (
    <Link
      ref={tiltRef}
      href={`/haber/${a.slug}`}
      className={`s-card s-reveal s-tilt ${variant === 'row' ? 's-card-row' : ''}`}
      style={revealDelay ? ({ '--reveal-delay': `${revealDelay}ms` } as React.CSSProperties) : undefined}
    >
      <div className="s-card-media">
        {/* Görsel /img/[id] endpoint'inden gelir — data-URI'ler HTML'e gömülmez;
            görsel yoksa endpoint markalı placeholder'a yönlendirir. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/img/${a.id}`} alt={a.imageAlt || a.title} loading="lazy" decoding="async" />
        {a.isBreaking ? (
          <span className="s-badge s-badge-breaking">Son Dakika</span>
        ) : a.categoryName ? (
          <span className="s-badge s-badge-cat">{a.categoryName}</span>
        ) : null}
        {/* İlçe rozeti — kategori/son dakika rozetiyle çakışmasın diye sağ üstte;
            detay sayfasındaki '📍 İlçe' rozetiyle aynı stil (s-badge-cat). */}
        {a.district && districtName(a.district) && (
          <span className="s-badge s-badge-cat" style={{ left: 'auto', right: 12 }}>
            📍 {districtName(a.district)}
          </span>
        )}
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
      {/* Tilt gloss (işaretçi konumuna göre parlama); yalnız tilt aktifken görünür */}
      <span className="s-card-gloss" aria-hidden="true" />
    </Link>
  );
}
