import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import ArticleCard, { type ArticleCardData } from '@/components/site/ArticleCard';
import Pagination from '@/components/site/pages/Pagination';
import RevealInit from '@/components/site/pages/RevealInit';
import DistrictFilter from '@/components/site/DistrictFilter';
import { DISTRICTS, normalizeDistrict } from '@/lib/districts';
import '@/app/(public)/pages.css';

export const revalidate = 120;

const SITE_URL = 'https://canakkale.network';
const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: 'Tüm Haberler',
  description:
    "Çanakkale Network haber arşivi — son dakika, röportajlar, üniversite, etkinlik ve spor haberlerinin tamamı.",
  alternates: { canonical: `${SITE_URL}/haberler` },
  openGraph: {
    title: 'Tüm Haberler — Çanakkale Network',
    description: 'Çanakkale Network haber arşivi.',
    url: `${SITE_URL}/haberler`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) || '';
}

export default async function ArchivePage(context: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await context.searchParams;
  const q = first(sp.q).trim().slice(0, 120);
  const kategori = first(sp.kategori).trim();
  const ilce = normalizeDistrict(first(sp.ilce)); // slug | null
  const page = Math.max(1, parseInt(first(sp.sayfa) || '1', 10) || 1);

  // İlçe dışındaki temel filtre — ilçe pil sayaçları bu bağlamda hesaplanır
  const baseWhere = {
    status: 'published',
    deletedAt: null,
    ...(kategori ? { categorySlug: kategori } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { summary: { contains: q, mode: 'insensitive' as const } },
            { body: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const where = { ...baseWhere, ...(ilce ? { district: ilce } : {}) };

  const [total, articles, categories, districtGroups] = await Promise.all([
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
    prisma.siteCategory.findMany({ orderBy: { order: 'asc' } }),
    // İlçe pil sayaçları — ilçe filtresi HARİÇ mevcut bağlamda (q/kategori)
    prisma.siteArticle.groupBy({ by: ['district'], where: baseWhere, _count: { _all: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // İlçe başına sayaç + "Tümü" toplamı (ilçe filtresinden bağımsız)
  const districtCounts: Record<string, number> = {};
  let districtTotal = 0;
  for (const g of districtGroups) {
    districtTotal += g._count._all;
    if (g.district) districtCounts[g.district] = g._count._all;
  }

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

  // Sayfalama + çip linklerinde korunacak sorgu parametreleri
  const baseQuery: Record<string, string> = {};
  if (q) baseQuery.q = q;
  if (kategori) baseQuery.kategori = kategori;
  if (ilce) baseQuery.ilce = ilce;

  const chipHref = (catSlug: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (catSlug) params.set('kategori', catSlug);
    if (ilce) params.set('ilce', ilce);
    const qs = params.toString();
    return qs ? `/haberler?${qs}` : '/haberler';
  };

  return (
    <div>
      <RevealInit />
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">Arşiv</span>
          <h1 className="p-page-title">
            Tüm Haberler<span className="tint">.</span>
          </h1>
          <p className="p-page-sub">Şehirde olan biten her şey — arayın, filtreleyin, okuyun.</p>

          <form className="p-search" action="/haberler" method="get" role="search">
            {kategori && <input type="hidden" name="kategori" value={kategori} />}
            {ilce && <input type="hidden" name="ilce" value={ilce} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Haberlerde ara… (başlık, özet, içerik)"
              aria-label="Haberlerde ara"
            />
            <button type="submit" className="s-btn s-btn-primary">
              Ara
            </button>
          </form>

          {categories.length > 0 && (
            <nav className="p-chips" aria-label="Kategori filtresi">
              <Link href={chipHref(null)} className={`p-chip ${!kategori ? 'active' : ''}`}>
                Tümü
              </Link>
              {categories.map(c => (
                <Link
                  key={c.slug}
                  href={chipHref(c.slug)}
                  className={`p-chip ${kategori === c.slug ? 'active' : ''}`}
                  style={c.color ? ({ '--chip-color': c.color } as React.CSSProperties) : undefined}
                >
                  <span className="swatch" aria-hidden="true" />
                  {c.name}
                </Link>
              ))}
            </nav>
          )}

          <DistrictFilter
            districts={DISTRICTS}
            active={ilce || ''}
            counts={districtCounts}
            total={districtTotal}
          />
        </div>
      </header>

      <section className="s-section" style={{ paddingTop: 'clamp(24px, 4vw, 44px)' }}>
        <div className="s-container">
          <p className="p-result-note" role="status">
            {q ? (
              <>
                &ldquo;<strong>{q}</strong>&rdquo; için <strong>{total.toLocaleString('tr-TR')}</strong> sonuç bulundu.
              </>
            ) : (
              <>
                Toplam <strong>{total.toLocaleString('tr-TR')}</strong> haber.
              </>
            )}
          </p>

          {cards.length > 0 ? (
            <>
              <div className="p-grid">
                {cards.map((a, i) => (
                  <ArticleCard key={a.slug} article={a} revealDelay={(i % 4) * 90} />
                ))}
              </div>
              <Pagination current={page} totalPages={totalPages} basePath="/haberler" query={baseQuery} />
            </>
          ) : (
            <div className="p-empty">
              <span className="glyph" aria-hidden="true">
                🔍
              </span>
              <h2>Sonuç bulunamadı</h2>
              <p>
                {q
                  ? 'Farklı bir anahtar kelime dene veya filtreyi kaldırıp tüm arşive göz at.'
                  : 'Henüz yayınlanmış haber yok — çok yakında burası dolacak.'}
              </p>
              {(q || kategori) && (
                <Link className="s-btn s-btn-primary" href="/haberler">
                  Filtreleri Temizle
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
