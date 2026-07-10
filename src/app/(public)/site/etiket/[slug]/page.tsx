import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { displayViews, getViewBoostSettings } from '@/lib/view-boost';
import ArticleCard, { type ArticleCardData } from '@/components/site/ArticleCard';
import Pagination from '@/components/site/pages/Pagination';
import RevealInit from '@/components/site/pages/RevealInit';
import '@/app/(public)/pages.css';

export const dynamic = 'force-dynamic'; // etiketler serbest metin; build'de prerender etme

const SITE_URL = 'https://canakkale.network';
const PAGE_SIZE = 12;

/**
 * Etiket hub'ı: SiteArticle.tags (JSON string dizisi) içinde bu etiketi barındıran
 * yayınlanmış haberler. Route param'ı Next tarafından URL-decode edilir; etiket
 * metni JSON içinde `"etiket"` biçiminde eşleştirilir (büyük/küçük harf duyarsız).
 */

export async function generateMetadata(context: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await context.params;
  const tag = decodeURIComponent(slug);
  return {
    title: `#${tag}`,
    description: `"${tag}" etiketli haberler — Çanakkale Network.`,
    alternates: { canonical: `${SITE_URL}/etiket/${encodeURIComponent(tag)}` },
    openGraph: {
      title: `#${tag} — Çanakkale Network`,
      description: `"${tag}" etiketli haberler.`,
      url: `${SITE_URL}/etiket/${encodeURIComponent(tag)}`,
      siteName: 'Çanakkale Network',
      locale: 'tr_TR',
    },
  };
}

export default async function EtiketPage(context: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await context.params;
  const sp = await context.searchParams;
  const tag = decodeURIComponent(slug).trim();
  if (!tag) notFound();

  const pageParam = Array.isArray(sp.sayfa) ? sp.sayfa[0] : sp.sayfa;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);

  // tags JSON içinde `"etiket"` öğesi olarak ara (tırnaklı → tam öğe eşleşmesi)
  const where = {
    status: 'published',
    deletedAt: null,
    tags: { contains: `"${tag}"`, mode: 'insensitive' as const },
  };

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
          views: true, viewBoost: true, authorName: true, category: { select: { name: true } },
        },
      }),
    ]);
  } catch {
    // DB erişilemezse boş liste
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Sitede gösterilen sayı = views + takviye (haber detayıyla tutarlı)
  const boostCfg = await getViewBoostSettings();
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
    views: displayViews(a, boostCfg),
    authorName: a.authorName,
  }));

  return (
    <div>
      <RevealInit />
      <header className="p-page-head" style={{ '--head-tint': '#2fb96b' } as React.CSSProperties}>
        <div className="s-container">
          <span className="s-kicker" style={{ color: '#2fb96b' }}>
            Etiket
          </span>
          <h1 className="p-page-title">
            #{tag}
            <span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            {total > 0
              ? `"${tag}" etiketli ${total.toLocaleString('tr-TR')} haber.`
              : `"${tag}" etiketiyle henüz haber yok.`}
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
              <Pagination current={page} totalPages={totalPages} basePath={`/etiket/${encodeURIComponent(tag)}`} />
            </>
          ) : (
            <div className="p-empty">
              <span className="glyph" aria-hidden="true">🏷️</span>
              <h2>Bu etikette haber yok</h2>
              <p>&quot;{tag}&quot; etiketli bir haber yayınlandığında burada listelenecek.</p>
              <a className="s-btn s-btn-primary" href="/haberler">Tüm Haberler</a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
