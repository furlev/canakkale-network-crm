import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import prisma from '@/lib/prisma';
import ArticleCard, { type ArticleCardData } from '@/components/site/ArticleCard';
import Pagination from '@/components/site/pages/Pagination';
import RevealInit from '@/components/site/pages/RevealInit';
import '@/app/(public)/pages.css';

export const revalidate = 120;

const SITE_URL = 'https://canakkale.network';
const PAGE_SIZE = 12;

const getCategory = cache(async (slug: string) =>
  prisma.siteCategory.findUnique({ where: { slug } })
);

export async function generateMetadata(context: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await context.params;
  const category = await getCategory(slug);
  if (!category) return { title: 'Kategori bulunamadı' };
  return {
    title: `${category.name} Haberleri`,
    description: `Çanakkale Network — ${category.name} kategorisindeki en güncel haberler.`,
    alternates: { canonical: `${SITE_URL}/kategori/${category.slug}` },
    openGraph: {
      title: `${category.name} Haberleri — Çanakkale Network`,
      description: `${category.name} kategorisindeki en güncel haberler.`,
      url: `${SITE_URL}/kategori/${category.slug}`,
      siteName: 'Çanakkale Network',
      locale: 'tr_TR',
    },
  };
}

export default async function CategoryPage(context: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await context.params;
  const sp = await context.searchParams;
  const category = await getCategory(slug);
  if (!category) notFound();

  const pageParam = Array.isArray(sp.sayfa) ? sp.sayfa[0] : sp.sayfa;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);

  const where = { status: 'published', deletedAt: null, categorySlug: category.slug };
  const [total, articles] = await Promise.all([
    prisma.siteArticle.count({ where }),
    prisma.siteArticle.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const cards: ArticleCardData[] = articles.map(a => ({
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    imageUrl: a.imageUrl,
    imageAlt: a.imageAlt,
    imageIsAi: a.imageIsAi,
    categorySlug: a.categorySlug,
    categoryName: category.name,
    isBreaking: a.isBreaking,
    publishedAt: a.publishedAt,
    views: a.views,
    authorName: a.authorName,
  }));

  const tint = category.color || undefined;

  return (
    <div>
      <RevealInit />
      <header
        className="p-page-head"
        style={tint ? ({ '--head-tint': tint } as React.CSSProperties) : undefined}
      >
        <div className="s-container">
          <span className="s-kicker" style={tint ? { color: tint } : undefined}>
            Kategori
          </span>
          <h1 className="p-page-title">
            {category.name}
            <span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            {total > 0
              ? `Bu kategoride ${total.toLocaleString('tr-TR')} haber var.`
              : 'Bu kategoride henüz haber yayınlanmadı.'}
          </p>
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
              <Pagination current={page} totalPages={totalPages} basePath={`/kategori/${category.slug}`} />
            </>
          ) : (
            <div className="p-empty">
              <span className="glyph" aria-hidden="true">
                🗞️
              </span>
              <h2>Henüz haber yok</h2>
              <p>Bu kategoriye ilk haber düştüğünde burada olacak. Meydanı boş bırakmayız.</p>
              <a className="s-btn s-btn-primary" href="/haberler">
                Tüm Haberlere Göz At
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
