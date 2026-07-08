import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { formatDateTr, readingMinutes, stripHtml } from '@/lib/site';
import { sanitizeHtml, youtubeEmbedUrl } from '@/lib/sanitize';
import ArticleCard, { type ArticleCardData } from '@/components/site/ArticleCard';
import ReadingProgress from '@/components/site/pages/ReadingProgress';
import ViewBeacon from '@/components/site/pages/ViewBeacon';
import ShareBar from '@/components/site/pages/ShareBar';
import RevealInit from '@/components/site/pages/RevealInit';
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
  const bodyHtml = sanitizeHtml(article.body);
  const catColor = article.category?.color || undefined;

  // İlgili haberler: aynı kategoriden son 4 (bu haber hariç)
  const related = await prisma.siteArticle.findMany({
    where: {
      status: 'published',
      deletedAt: null,
      slug: { not: article.slug },
      ...(article.categorySlug ? { categorySlug: article.categorySlug } : {}),
    },
    // publishedAt=null satırlar tepeye yapışmasın
    orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
    take: 4,
    // body ve imageUrl (data-URI olabilir) ASLA seçilmez — satırlar hafif kalır
    select: {
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
      category: { select: { name: true } },
    },
  });

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
  }));

  // NewsArticle JSON-LD (Google Haberler)
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
    // Görsel varsa (gerçek URL veya AI data-URI) /img/[id] endpoint'i üzerinden ver
    ...(article.imageUrl ? { image: [`${SITE_URL}/img/${article.id}`] } : {}),
  };

  return (
    <article>
      <ReadingProgress />
      <ViewBeacon slug={article.slug} />
      <RevealInit />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
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
            <h1 className="p-hero-title">{article.title}</h1>
            <div className="p-hero-meta">
              <span className="author">{article.authorName}</span>
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
        {article.summary && <p className="p-article-summary">{article.summary}</p>}

        {embedUrl && (
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

        <div className="prose" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

        <ShareBar url={canonical} title={article.title} />

        {tags.length > 0 && (
          <nav className="p-tags" aria-label="Etiketler">
            {tags.map(tag => (
              <Link key={tag} href={`/haberler?q=${encodeURIComponent(tag)}`} className="p-tag">
                {tag}
              </Link>
            ))}
          </nav>
        )}

        {sources.length > 0 && (
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

      {/* ── İlgili haberler ── */}
      {relatedCards.length > 0 && (
        <section className="s-section">
          <div className="s-container">
            <div className="s-section-head">
              <div>
                <span className="s-kicker">Devamı Gelsin</span>
                <h2 className="s-section-title">
                  İlgili Haberler<span className="tick">.</span>
                </h2>
              </div>
            </div>
            <div className="p-grid">
              {relatedCards.map((r, i) => (
                <ArticleCard key={r.slug} article={r} revealDelay={i * 90} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
