import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { formatDateTr, readingMinutes, stripHtml, slugifyTr } from '@/lib/site';
import { sanitizeHtml, youtubeEmbedUrl } from '@/lib/sanitize';
import ArticleCard, { type ArticleCardData } from '@/components/site/ArticleCard';
import MagneticCTA from '@/components/site/MagneticCTA';
import CorrectionBanner from '@/components/site/CorrectionBanner';
import AdSlot from '@/components/site/AdSlot';
import { districtName } from '@/lib/districts';
import ReadingProgress from '@/components/site/pages/ReadingProgress';
import ViewBeacon from '@/components/site/pages/ViewBeacon';
import ShareBar from '@/components/site/pages/ShareBar';
import RevealInit from '@/components/site/pages/RevealInit';
import Lightbox, { type GalleryImage } from '@/components/site/Lightbox';
import Comments from '@/components/site/Comments';
import Paywall from '@/components/site/Paywall';
import { getCurrentReader } from '@/lib/reader-auth';
import '@/app/(public)/pages.css';

export const revalidate = 120;

const SITE_URL = 'https://canakkale.network';

const getArticle = cache(async (slug: string) =>
  prisma.siteArticle.findFirst({
    where: { slug, status: 'published', deletedAt: null },
    include: { category: true },
  })
);

/** JSON string → string dizisi (etiketler). */
function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : [];
  } catch {
    return [];
  }
}

/** JSON string → kaynak linkleri ({title,url} veya düz string destekler). */
function parseSources(raw: string | null): { title: string; url: string }[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map(item => {
        if (typeof item === 'string') return { title: item, url: item };
        if (item && typeof item === 'object' && typeof item.url === 'string') {
          return { title: typeof item.title === 'string' && item.title ? item.title : item.url, url: item.url };
        }
        return null;
      })
      .filter((s): s is { title: string; url: string } => s !== null && /^https?:\/\//i.test(s.url));
  } catch {
    return [];
  }
}

/**
 * JSON string → galeri görselleri ([{url,alt}]). Yalnız http(s) URL'ler geçer
 * (javascript:/data: gibi şemalar elenir); alt zorunlu değildir. Bozuk/boş → [].
 */
function parseGallery(raw: string | null): GalleryImage[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map(item => {
        const url = typeof item === 'string' ? item : item && typeof item === 'object' ? item.url : null;
        if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
        const alt = item && typeof item === 'object' && typeof item.alt === 'string' ? item.alt : '';
        return { url, alt } as GalleryImage;
      })
      .filter((g): g is GalleryImage => g !== null);
  } catch {
    return [];
  }
}

/** videoUrl doğrudan bir video dosyası mı? (YouTube değil, .mp4/.webm/.ogg http(s)) */
function directVideoUrl(url: string | null | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url) ? url : null;
}

/**
 * Premium paywall (W2-B) için gövdeyi kırpar: sanitize edilmiş HTML'i blok
 * sınırlarından (kapanış etiketi sonrası) böler ve ilk ~%30'unu (en az 1 blok)
 * döndürür — tam bloklar alınır, etiket ortadan kesilmez. Blok tespit edilemezse
 * (etiketsiz düz metin) güvenli düz-metin özetine düşer.
 */
function previewHtml(html: string): string {
  const blocks = html
    .split(/(?<=<\/(?:p|h2|h3|h4|ul|ol|blockquote|figure|table|pre)>)/i)
    .filter(b => b.trim() !== '');
  if (blocks.length <= 1) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text ? `<p>${text.slice(0, 400)}…</p>` : '';
  }
  const keep = Math.max(1, Math.floor(blocks.length * 0.3));
  return blocks.slice(0, keep).join('');
}

export async function generateMetadata(context: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await context.params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Haber bulunamadı' };

  const title = article.seoTitle || article.title;
  const description = article.metaDescription || article.summary || stripHtml(article.body, 160);
  const canonical = `${SITE_URL}/haber/${article.slug}`;
  // Görsel varsa (gerçek URL veya AI data-URI) mutlak endpoint URL'i ver;
  // /img/[id] gerçek URL'e 308, data-URI'yi decode edip servis eder.
  const ogImage = article.imageUrl ? `${SITE_URL}/img/${article.id}` : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      siteName: 'Çanakkale Network',
      locale: 'tr_TR',
      publishedTime: article.publishedAt?.toISOString(),
      ...(ogImage ? { images: [{ url: ogImage, alt: article.imageAlt || article.title }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function ArticlePage(context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const canonical = `${SITE_URL}/haber/${article.slug}`;
  const minutes = readingMinutes(article.body);
  const tags = parseTags(article.tags);
  const sources = parseSources(article.sourceLinks);
  const embedUrl = youtubeEmbedUrl(article.videoUrl);
  // YouTube değilse doğrudan video dosyası (mp4/webm/ogg) fallback'i
  const directVideo = embedUrl ? null : directVideoUrl(article.videoUrl);
  const gallery = parseGallery(article.gallery);
  const bodyHtml = sanitizeHtml(article.body);
  const catColor = article.category?.color || undefined;

  // ── Premium paywall (W2-B) ──
  // Cookie yalnızca premium haberde okunur; sıradan haberler statik/ISR olarak
  // kalır (getCurrentReader → cookies() yalnız burada, koşullu çağrılır).
  const reader = article.isPremium ? await getCurrentReader() : null;
  const locked = article.isPremium && !reader?.isPremium;
  const displayHtml = locked ? previewHtml(bodyHtml) : bodyHtml;
  const paymentEnabled = !!process.env.PAYMENT_PROVIDER;

  // Yazar hub bağı: authorSlug varsa onu, yoksa yazar adından türetilmiş slug'ı kullan.
  // Kurumsal imza (varsayılan "Çanakkale Network") için kişisel hub yok → düz metin.
  const authorHubSlug =
    article.authorSlug || (article.authorName && article.authorName !== 'Çanakkale Network'
      ? slugifyTr(article.authorName)
      : null);

  // İlgili haberler: ETİKET BENZERLİĞİ ile seçilir (aynı kategori yerine).
  // Skor = bu haberin etiketleri ile adayın etiketlerinin kesişim sayısı;
  // skor eşitse yayın tarihine (yeni → eski) göre sıralanır.
  // body ve imageUrl (data-URI olabilir) ASLA seçilmez — satırlar hafif kalır.
  const relatedSelect = {
    id: true,
    slug: true,
    title: true,
    summary: true,
    imageAlt: true,
    imageIsAi: true,
    categorySlug: true,
    isBreaking: true,
    publishedAt: true,
    views: true,
    authorName: true,
    district: true,
    videoUrl: true, // '▶ Video' rozeti için (küçük string)
    tags: true, // kesişim skoru için (küçük JSON string)
    category: { select: { name: true } },
  } as const;

  const relatedBaseWhere = {
    status: 'published',
    deletedAt: null,
    slug: { not: article.slug },
  } as const;

  // (1) En az bir ortak etikete sahip yayınlar (etiket varsa)
  const tagMatches =
    tags.length > 0
      ? await prisma.siteArticle.findMany({
          where: {
            ...relatedBaseWhere,
            OR: tags.slice(0, 8).map(t => ({ tags: { contains: `"${t}"`, mode: 'insensitive' as const } })),
          },
          orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
          take: 24,
          select: relatedSelect,
        })
      : [];

  // (2) Yedek dolgu — etiket eşleşmesi 4'ü doldurmuyorsa son yayınlarla tamamla
  const recentFill =
    tagMatches.length < 4
      ? await prisma.siteArticle.findMany({
          where: relatedBaseWhere,
          orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
          take: 8,
          select: relatedSelect,
        })
      : [];

  // Benzersizleştir (slug), etiket kesişim skoruna göre sırala, ilk 4'ü al
  type RelatedRow = (typeof tagMatches)[number];
  const relatedSeen = new Set<string>();
  const relatedPool: RelatedRow[] = [];
  for (const r of [...tagMatches, ...recentFill]) {
    if (relatedSeen.has(r.slug)) continue;
    relatedSeen.add(r.slug);
    relatedPool.push(r);
  }

  const myTags = new Set(tags.map(t => t.toLocaleLowerCase('tr-TR')));
  const tagScore = (r: RelatedRow): number =>
    parseTags(r.tags).reduce((n, t) => (myTags.has(t.toLocaleLowerCase('tr-TR')) ? n + 1 : n), 0);

  const related = relatedPool
    .map(r => ({ r, score: tagScore(r) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ad = a.r.publishedAt ? a.r.publishedAt.getTime() : 0;
      const bd = b.r.publishedAt ? b.r.publishedAt.getTime() : 0;
      return bd - ad;
    })
    .slice(0, 4)
    .map(x => x.r);

  const relatedCards: ArticleCardData[] = related.map(r => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    imageAlt: r.imageAlt,
    imageIsAi: r.imageIsAi,
    categorySlug: r.categorySlug,
    categoryName: r.category?.name || null,
    isBreaking: r.isBreaking,
    publishedAt: r.publishedAt,
    views: r.views,
    authorName: r.authorName,
    district: r.district,
    hasVideo: !!r.videoUrl,
  }));

  // NewsArticle JSON-LD (Google Haberler) — articleSection (kategori) + keywords (etiketler)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.metaDescription || article.summary || undefined,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    mainEntityOfPage: canonical,
    author: { '@type': 'Person', name: article.authorName },
    publisher: { '@type': 'NewsMediaOrganization', name: 'Çanakkale Network', url: SITE_URL },
    ...(article.category ? { articleSection: article.category.name } : {}),
    ...(tags.length > 0 ? { keywords: tags } : {}),
    // Görsel varsa (gerçek URL veya AI data-URI) /img/[id] endpoint'i üzerinden ver
    ...(article.imageUrl ? { image: [`${SITE_URL}/img/${article.id}`] } : {}),
  };

  // BreadcrumbList JSON-LD (Ana Sayfa > Kategori > Haber)
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      ...(article.category
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: article.category.name,
              item: `${SITE_URL}/kategori/${article.category.slug}`,
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: article.category ? 3 : 2,
        name: article.title,
        item: canonical,
      },
    ],
  };

  return (
    <article>
      <ReadingProgress />
      <ViewBeacon slug={article.slug} altTitle={article.altTitle} articleId={article.id} />
      <RevealInit />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c') }}
      />

      {/* ── Sinematik hero ── */}
      <header className={`p-hero ${article.imageUrl ? '' : 'p-hero-noimg'}`}>
        {article.imageUrl && (
          <div className="p-hero-media">
            {/* Görsel /img/[id] endpoint'inden gelir — data-URI HTML'e gömülmez.
                Bu, sayfanın LCP öğesi: yüksek öncelikle çekilir. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/img/${article.id}`}
              alt={article.imageAlt || article.title}
              fetchPriority="high"
              decoding="async"
              style={{ viewTransitionName: `photo-${article.slug}` } as React.CSSProperties}
            />
          </div>
        )}
        {article.imageUrl && article.imageIsAi && (
          <span className="p-hero-ai">🎨 Temsili görsel — yapay zekâ ile üretilmiştir</span>
        )}
        <div className="p-hero-inner">
          <div className="s-container">
            {article.isBreaking ? (
              <span className="s-badge s-badge-breaking">Son Dakika</span>
            ) : article.category ? (
              <Link
                href={`/kategori/${article.category.slug}`}
                className="s-badge s-badge-cat"
                style={catColor ? ({ '--badge-color': catColor } as React.CSSProperties) : undefined}
              >
                {article.category.name}
              </Link>
            ) : null}
            {article.district && districtName(article.district) && (
              <Link href={`/ilce/${article.district}`} className="s-badge s-badge-cat">
                📍 {districtName(article.district)}
              </Link>
            )}
            <h1 className="p-hero-title">{article.title}</h1>
            <div className="p-hero-meta">
              {authorHubSlug ? (
                <Link href={`/yazar/${authorHubSlug}`} className="author">
                  {article.authorName}
                </Link>
              ) : (
                <span className="author">{article.authorName}</span>
              )}
              {article.publishedAt && (
                <>
                  <span className="sep" aria-hidden="true" />
                  <time dateTime={article.publishedAt.toISOString()}>{formatDateTr(article.publishedAt)}</time>
                </>
              )}
              <span className="sep" aria-hidden="true" />
              <span>{minutes} dk okuma</span>
              {article.views > 0 && (
                <>
                  <span className="sep" aria-hidden="true" />
                  <span>{article.views.toLocaleString('tr-TR')} görüntülenme</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Gövde ── */}
      <div className="p-article">
        <CorrectionBanner
          correctionNote={article.correctionNote}
          correctedAt={article.correctedAt}
          retractedAt={article.retractedAt}
          retractionNote={article.retractionNote}
        />
        {article.summary && <p className="p-article-summary">{article.summary}</p>}

        {!locked && embedUrl && (
          <div className="p-video">
            <iframe
              src={embedUrl}
              title={article.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        )}

        {!locked && directVideo && (
          <div className="p-video">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={directVideo}
              controls
              playsInline
              preload="metadata"
              title={article.title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#000' }}
            />
          </div>
        )}

        <div className="prose" dangerouslySetInnerHTML={{ __html: displayHtml }} />

        {locked && (
          <Paywall authenticated={!!reader} paymentEnabled={paymentEnabled} slug={article.slug} />
        )}

        {!locked && gallery.length > 0 && <Lightbox images={gallery} title={article.title} />}

        <ShareBar url={canonical} title={article.title} />

        <AdSlot placement="native" district={article.district} />

        {tags.length > 0 && (
          <nav className="p-tags" aria-label="Etiketler">
            {tags.map(tag => (
              <Link key={tag} href={`/etiket/${encodeURIComponent(tag)}`} className="p-tag">
                {tag}
              </Link>
            ))}
          </nav>
        )}

        {!locked && sources.length > 0 && (
          <section className="p-sources" aria-label="Kaynaklar">
            <h2>Kaynaklar</h2>
            <ul>
              {sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* ── Okuyucu yorumları ── */}
      <div className="s-container">
        <Comments articleId={article.id} />
      </div>

      {/* ── İlgili haberler ── */}
      {relatedCards.length > 0 && (
        <section className="s-section">
          <div className="s-container">
            <div className="s-section-head s-reveal" data-reveal="left">
              <div>
                <span className="s-kicker">Devamı Gelsin</span>
                <h2 className="s-section-title">
                  İlgili Haberler<span className="tick">.</span>
                </h2>
              </div>
            </div>
            <div className="p-grid" data-reveal-stagger="90">
              {relatedCards.map((r, i) => (
                <ArticleCard key={r.slug} article={r} revealDelay={i * 90} reveal="scale" />
              ))}
            </div>
            {/* Birincil CTA — manyetik (pointer:fine + motion full iken çekim; aksi halde normal buton) */}
            <div className="s-reveal" data-reveal="scale" style={{ marginTop: 'var(--space-6, 32px)', textAlign: 'center' }}>
              <MagneticCTA href="/haberler" className="s-btn s-btn-primary">
                Tüm Haberleri Gör
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </MagneticCTA>
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
