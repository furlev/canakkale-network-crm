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
  /** Kayıt amaçlı — sitede "Temsili görsel" rozeti artık GÖSTERİLMEZ
   *  (bilgilendirme /gorsel-politikasi sayfasında). Alan geriye uyum için tipte durur. */
  imageIsAi?: boolean;
  categorySlug?: string | null;
  categoryName?: string | null;
  isBreaking?: boolean;
  publishedAt?: Date | string | null;
  /** Gösterilecek görüntülenme — sunucu displayViews (görüntülenme takviyesi dahil,
   *  src/lib/view-boost.ts) ile hesaplayıp sayı olarak geçebilir. */
  views?: number;
  authorName?: string | null;
  /** Çanakkale ilçe slug'ı (varsa kartta '📍 İlçe' rozeti gösterilir). */
  district?: string | null;
  /** Habere bağlı video (videoUrl) varsa kartta '▶ Video' rozeti gösterilir. */
  hasVideo?: boolean;
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
  reveal,
}: {
  article: ArticleCardData;
  variant?: 'default' | 'row';
  revealDelay?: number;
  /** REVEAL v2 (opt-in): yön/efekt (.s-reveal[data-reveal]). Verilmezse klasik yukarı-kayma. */
  reveal?: 'left' | 'right' | 'scale' | 'clip';
}) {
  const a = article;
  const tiltRef = useTilt<HTMLAnchorElement>({ max: 4 });
  return (
    <Link
      ref={tiltRef}
      href={`/haber/${a.slug}`}
      prefetch
      data-reveal={reveal}
      className={`s-card s-reveal s-tilt ${variant === 'row' ? 's-card-row' : ''}`}
      style={revealDelay ? ({ '--reveal-delay': `${revealDelay}ms` } as React.CSSProperties) : undefined}
    >
      <div className="s-card-media">
        {/* Görsel /img/[id] endpoint'inden gelir — data-URI'ler HTML'e gömülmez;
            görsel yoksa endpoint markalı placeholder'a yönlendirir. */}
        {/* Paylaşılan öğe geçişi (View Transitions): kapak görseline slug'a özgü ad;
            haber detay hero görseli aynı adı taşır → tıklamada morph. Desteklemeyen
            tarayıcıda no-op. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/img/${a.id}`}
          alt={a.imageAlt || a.title}
          loading="lazy"
          decoding="async"
          style={{ viewTransitionName: `photo-${a.slug}` } as React.CSSProperties}
        />
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
        {/* Video rozeti — medyanın sol altında; kategori (sol üst) ve ilçe (sağ üst)
            rozetleriyle çakışmaz. */}
        {a.hasVideo && (
          <span
            className="s-badge"
            style={{
              top: 'auto',
              bottom: 12,
              left: 12,
              gap: 5,
              background: 'rgba(12, 14, 20, 0.62)',
              color: '#fff',
              backdropFilter: 'blur(6px)',
            }}
          >
            <span aria-hidden="true">▶</span> Video
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
        </div>
      </div>
      {/* Tilt gloss (işaretçi konumuna göre parlama); yalnız tilt aktifken görünür */}
      <span className="s-card-gloss" aria-hidden="true" />
    </Link>
  );
}
