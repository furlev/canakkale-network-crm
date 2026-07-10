import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { displayViews, getViewBoostSettings } from '@/lib/view-boost';
import ArticleCard, { type ArticleCardData } from '@/components/site/ArticleCard';
import Pagination from '@/components/site/pages/Pagination';
import RevealInit from '@/components/site/pages/RevealInit';
import DistrictMap from '@/components/site/DistrictMap';
import { DISTRICT_SLUGS, getDistrict } from '@/lib/districts';
import '@/app/(public)/pages.css';

export const revalidate = 120;

const SITE_URL = 'https://canakkale.network';
const PAGE_SIZE = 12;

/** 11 ilçe slug'ı statik parametre olarak (build sırasında bilinir). */
export function generateStaticParams() {
  return DISTRICT_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata(context: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await context.params;
  const district = getDistrict(slug);
  if (!district) return { title: 'İlçe bulunamadı' };
  return {
    title: `${district.name} Haberleri`,
    description: `Çanakkale ${district.name} ilçesinden en güncel haberler — son dakika, etkinlik ve yerel gündem. Çanakkale Network.`,
    alternates: {
      canonical: `${SITE_URL}/ilce/${district.slug}`,
      types: { 'application/rss+xml': `${SITE_URL}/ilce/${district.slug}/feed.xml` },
    },
    openGraph: {
      title: `${district.name} Haberleri — Çanakkale Network`,
      description: `Çanakkale ${district.name} ilçesinden en güncel haberler.`,
      url: `${SITE_URL}/ilce/${district.slug}`,
      siteName: 'Çanakkale Network',
      locale: 'tr_TR',
    },
  };
}

export default async function DistrictPage(context: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await context.params;
  const sp = await context.searchParams;
  const district = getDistrict(slug);
  if (!district) notFound();

  const pageParam = Array.isArray(sp.sayfa) ? sp.sayfa[0] : sp.sayfa;
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);

  const where = { status: 'published', deletedAt: null, district: district.slug };
  const [total, articles, districtGroups] = await Promise.all([
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
        viewBoost: true,
        authorName: true,
        category: { select: { name: true } },
      },
    }),
    // Tüm ilçelerin haber sayıları — alt haritadaki rozetler için
    prisma.siteArticle.groupBy({
      by: ['district'],
      where: { status: 'published', deletedAt: null },
      _count: { _all: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const counts: Record<string, number> = {};
  for (const g of districtGroups) {
    if (g.district) counts[g.district] = g._count._all;
  }

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
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">İlçe</span>
          <h1 className="p-page-title">
            {district.name}
            <span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            {total > 0
              ? `${district.name} ilçesinden ${total.toLocaleString('tr-TR')} haber.`
              : `${district.name} ilçesinden henüz haber yayınlanmadı.`}
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
              <Pagination current={page} totalPages={totalPages} basePath={`/ilce/${district.slug}`} />
            </>
          ) : (
            <div className="p-empty">
              <span className="glyph" aria-hidden="true">
                🗺️
              </span>
              <h2>Bu ilçeden haber yok</h2>
              <p>{district.name} ilçesine ilk haber düştüğünde burada olacak. Diğer ilçelere göz atabilirsin.</p>
              <a className="s-btn s-btn-primary" href="/haberler">
                Tüm Haberlere Göz At
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Çanakkale'nin diğer ilçeleri — hızlı gezinme */}
      <section className="s-section" style={{ paddingTop: 0 }}>
        <div className="s-container">
          <div className="s-section-head">
            <h2 className="s-section-title">
              İlçe İlçe Çanakkale<span className="tick">.</span>
            </h2>
          </div>
          <DistrictMap counts={counts} active={district.slug} />
        </div>
      </section>
    </div>
  );
}
