import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import ArticleCard, { type ArticleCardData } from '@/components/site/ArticleCard';
import Pagination from '@/components/site/pages/Pagination';
import RevealInit from '@/components/site/pages/RevealInit';
import '@/app/(public)/pages.css';

export const dynamic = 'force-dynamic'; // slug'lar DB'den; build'de prerender etme

const SITE_URL = 'https://canakkale.network';
const PAGE_SIZE = 12;

async function loadAuthor(slug: string) {
  try {
    return await prisma.author.findUnique({ where: { slug } });
  } catch {
    return null;
  }
}

export async function generateMetadata(context: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await context.params;
  const author = await loadAuthor(slug);
  const name = author?.name || slug;
  const desc = author?.bio
    ? author.bio.slice(0, 160)
    : `${name} imzalı haber ve yazılar — Çanakkale Network.`;
  return {
    title: `${name}${author?.title ? ` — ${author.title}` : ''}`,
    description: desc,
    alternates: { canonical: `${SITE_URL}/yazar/${slug}` },
    openGraph: {
      title: `${name} — Çanakkale Network`,
      description: desc,
      url: `${SITE_URL}/yazar/${slug}`,
      siteName: 'Çanakkale Network',
      locale: 'tr_TR',
      images: author?.avatar ? [{ url: author.avatar, alt: name }] : undefined,
    },
  };
}

export default async function YazarPage(context: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await context.params;
  const sp = await context.searchParams;
  const pageParam = Array.isArray(sp.sayfa) ? sp.sayfa[0] : sp.sayfa;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);

  const author = await loadAuthor(slug);

  const where = { status: 'published', deletedAt: null, authorSlug: slug };
  let total = 0;
  let articles: {
    id: string; slug: string; title: string; summary: string | null;
    imageAlt: string | null; imageIsAi: boolean; categorySlug: string | null;
    isBreaking: boolean; publishedAt: Date | null; views: number; authorName: string;
    category: { name: string } | null;
  }[] = [];
  try {
    [total, articles] = await Promise.all([
      prisma.siteArticle.count({ where }),
      prisma.siteArticle.findMany({
        where,
        orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, slug: true, title: true, summary: true, imageAlt: true,
          imageIsAi: true, categorySlug: true, isBreaking: true, publishedAt: true,
          views: true, authorName: true, category: { select: { name: true } },
        },
      }),
    ]);
  } catch {
    // DB erişilemezse boş liste
  }

  // Ne yazar kaydı ne de tek bir haber varsa → 404
  if (!author && total === 0) notFound();

  const displayName = author?.name || articles[0]?.authorName || slug;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const cards: ArticleCardData[] = articles.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    imageAlt: a.imageAlt,
    imageIsAi: a.imageIsAi,
    categorySlug: a.categorySlug,
    categoryName: a.category?.name || null,
    isBreaking: a.isBreaking,
    publishedAt: a.publishedAt,
    views: a.views,
    authorName: a.authorName,
  }));

  return (
    <div>
      <RevealInit />
      <header className="p-page-head" style={{ '--head-tint': '#8a5cd6' } as React.CSSProperties}>
        <div className="s-container">
          <span className="s-kicker" style={{ color: '#8a5cd6' }}>
            {author?.isColumnist ? 'Köşe Yazarı' : 'Yazar'}
          </span>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            {author?.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={author.avatar}
                alt={displayName}
                style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--line)' }}
              />
            )}
            <div>
              <h1 className="p-page-title" style={{ margin: 0 }}>
                {displayName}
                <span className="tint">.</span>
              </h1>
              {author?.title && (
                <div style={{ color: 'var(--ink-soft)', fontSize: 15, marginTop: 4 }}>{author.title}</div>
              )}
            </div>
          </div>
          {author?.bio && (
            <p className="p-page-sub" style={{ marginTop: 14 }}>{author.bio}</p>
          )}
          {!author?.bio && (
            <p className="p-page-sub">
              {total > 0
                ? `${displayName} imzalı ${total.toLocaleString('tr-TR')} içerik.`
                : `${displayName} imzalı içerik yakında.`}
            </p>
          )}
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          {cards.length > 0 ? (
            <>
              <div className="p-grid">
                {cards.map((a, i) => (
                  <ArticleCard key={a.slug} article={a} revealDelay={(i % 4) * 90} />
                ))}
              </div>
              <Pagination current={page} totalPages={totalPages} basePath={`/yazar/${slug}`} />
            </>
          ) : (
            <div className="p-empty">
              <span className="glyph" aria-hidden="true">✍️</span>
              <h2>Henüz içerik yok</h2>
              <p>{displayName} imzalı bir haber yayınlandığında burada listelenecek.</p>
              <a className="s-btn s-btn-primary" href="/haberler">Tüm Haberler</a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
