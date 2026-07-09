import type { Metadata } from 'next';
import { Prisma } from '@prisma/client';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import ArticleCard, { type ArticleCardData } from '@/components/site/ArticleCard';
import Pagination from '@/components/site/pages/Pagination';
import RevealInit from '@/components/site/pages/RevealInit';
import DistrictFilter from '@/components/site/DistrictFilter';
import SearchSuggest from '@/components/site/SearchSuggest';
import { DISTRICTS, normalizeDistrict } from '@/lib/districts';
import '@/app/(public)/pages.css';

/**
 * Arama alaka filtresi: Postgres to_tsvector('turkish', başlık+özet) ile eşleşen
 * makale id'lerini döner (gövde-LIKE yerine başlık+özet, dil-farkında kök bulma).
 * GIN index YOKSA da çalışır (seq-scan); ileride GIN index ile hızlanır.
 * Raw sorgu herhangi bir sebeple patlarsa başlık+özet contains'e zarifçe düşer.
 */
async function buildSearchFilter(q: string): Promise<Prisma.SiteArticleWhereInput | null> {
  if (!q) return null;
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "SiteArticle"
      WHERE status = 'published' AND "deletedAt" IS NULL
        AND to_tsvector('turkish', coalesce(title, '') || ' ' || coalesce(summary, ''))
            @@ plainto_tsquery('turkish', ${q})
      LIMIT 1000`;
    return { id: { in: rows.map(r => r.id) } };
  } catch {
    return {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
      ],
    };
  }
}

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
  const yazar = first(sp.yazar).trim().slice(0, 160); // yazar facet (authorName tam eşleşme)
  const ilce = normalizeDistrict(first(sp.ilce)); // slug | null
  const page = Math.max(1, parseInt(first(sp.sayfa) || '1', 10) || 1);

  // Arama: gövde-LIKE yerine to_tsvector('turkish', başlık+özet) alaka eşleşmesi.
  const qFilter = await buildSearchFilter(q);

  // İlçe dışındaki temel filtre — ilçe pil sayaçları bu bağlamda hesaplanır
  const baseWhere: Prisma.SiteArticleWhereInput = {
    status: 'published',
    deletedAt: null,
    ...(kategori ? { categorySlug: kategori } : {}),
    ...(qFilter ?? {}),
    ...(yazar ? { authorName: yazar } : {}),
  };
  const where: Prisma.SiteArticleWhereInput = { ...baseWhere, ...(ilce ? { district: ilce } : {}) };

  // Yazar facet sayaçları — yazar filtresi HARİÇ mevcut bağlamda (q/kategori/ilçe).
  const authorContextWhere: Prisma.SiteArticleWhereInput = {
    status: 'published',
    deletedAt: null,
    ...(kategori ? { categorySlug: kategori } : {}),
    ...(qFilter ?? {}),
    ...(ilce ? { district: ilce } : {}),
  };

  const [total, articles, categories, districtGroups, authorGroups] = await Promise.all([
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
    // Yazar facet — en çok haberi olan yazarlar (çip olarak gösterilir)
    prisma.siteArticle.groupBy({
      by: ['authorName'],
      where: authorContextWhere,
      _count: { _all: true },
      orderBy: { _count: { authorName: 'desc' } },
      take: 14,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Yazar çipleri: adı olan + en az bir haberi olan yazarlar (en çok yazandan aza).
  const authorFacets = authorGroups
    .filter(g => g.authorName && g.authorName.trim())
    .map(g => ({ name: g.authorName, count: g._count._all }));

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
  if (yazar) baseQuery.yazar = yazar;

  const chipHref = (catSlug: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (catSlug) params.set('kategori', catSlug);
    if (ilce) params.set('ilce', ilce);
    if (yazar) params.set('yazar', yazar);
    const qs = params.toString();
    return qs ? `/haberler?${qs}` : '/haberler';
  };

  // Yazar çipi linki — yazarı değiştirir/temizler, diğer filtreleri korur.
  const authorHref = (name: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (kategori) params.set('kategori', kategori);
    if (ilce) params.set('ilce', ilce);
    if (name) params.set('yazar', name);
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
            {yazar && <input type="hidden" name="yazar" value={yazar} />}
            <SearchSuggest name="q" defaultValue={q} placeholder="Haberlerde ara… (başlık, özet)" />
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

          {(authorFacets.length > 0 || yazar) && (
            <nav className="p-chips" aria-label="Yazar filtresi">
              <Link href={authorHref(null)} className={`p-chip ${!yazar ? 'active' : ''}`}>
                Tüm yazarlar
              </Link>
              {/* Aktif yazar listede yoksa (bağlam dışı) yine de çip olarak göster */}
              {yazar && !authorFacets.some(a => a.name === yazar) && (
                <Link href={authorHref(yazar)} className="p-chip active">
                  {yazar}
                </Link>
              )}
              {authorFacets.map(a => (
                <Link
                  key={a.name}
                  href={authorHref(a.name)}
                  className={`p-chip ${yazar === a.name ? 'active' : ''}`}
                >
                  {a.name}
                  <span className="count" aria-hidden="true"> · {a.count.toLocaleString('tr-TR')}</span>
                </Link>
              ))}
            </nav>
          )}
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
              {(q || kategori || yazar) && (
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
