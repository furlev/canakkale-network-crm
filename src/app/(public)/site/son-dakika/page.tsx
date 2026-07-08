import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import ArticleCard, { type ArticleCardData } from '@/components/site/ArticleCard';
import Pagination from '@/components/site/pages/Pagination';
import RevealInit from '@/components/site/pages/RevealInit';
import '@/app/(public)/pages.css';

export const revalidate = 60;

const SITE_URL = 'https://canakkale.network';
const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: 'Son Dakika',
  description:
    'Çanakkale Network son dakika haberleri — şehirde ve bölgede olan biten en güncel gelişmeler anında burada.',
  alternates: { canonical: `${SITE_URL}/son-dakika` },
  openGraph: {
    title: 'Son Dakika — Çanakkale Network',
    description: 'Çanakkale ve bölgeden son dakika gelişmeleri.',
    url: `${SITE_URL}/son-dakika`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) || '';
}

export default async function BreakingArchivePage(context: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await context.searchParams;
  const page = Math.max(1, parseInt(first(sp.sayfa) || '1', 10) || 1);

  const where = { status: 'published', deletedAt: null, isBreaking: true };

  const [total, articles] = await Promise.all([
    prisma.siteArticle.count({ where }),
    prisma.siteArticle.findMany({
      where,
      // publishedAt=null satırlar tepeye yapışmasın
      orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const cards: ArticleCardData[] = articles.map(a => ({
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
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">Canlı</span>
          <h1 className="p-page-title">
            Son Dakika<span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            Şehirde olan biteni ilk siz öğrenin — en güncel gelişmeler en üstte.
          </p>
        </div>
      </header>

      <section className="s-section" style={{ paddingTop: 'clamp(24px, 4vw, 44px)' }}>
        <div className="s-container">
          <p className="p-result-note" role="status">
            Toplam <strong>{total.toLocaleString('tr-TR')}</strong> son dakika haberi.
          </p>

          {cards.length > 0 ? (
            <>
              <div className="p-grid">
                {cards.map((a, i) => (
                  <ArticleCard key={a.slug} article={a} revealDelay={(i % 4) * 90} />
                ))}
              </div>
              <Pagination current={page} totalPages={totalPages} basePath="/son-dakika" />
            </>
          ) : (
            <div className="p-empty">
              <span className="glyph" aria-hidden="true">
                📡
              </span>
              <h2>Şu an son dakika yok</h2>
              <p>
                Sıcak bir gelişme olduğunda buraya anında düşecek. Bu arada tüm haber arşivine göz
                atabilirsiniz.
              </p>
              <Link className="s-btn s-btn-primary" href="/haberler">
                Tüm Haberler
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
