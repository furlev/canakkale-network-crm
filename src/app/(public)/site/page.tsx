import prisma from '@/lib/prisma';
import {
  DEFAULT_SITE_SETTINGS,
  formatDateTr,
  getSiteSettings,
  type SiteSettings,
} from '@/lib/site';
import ArticleCard, { type ArticleCardData } from '@/components/site/ArticleCard';
import HeroCinematic, { type HeroItem } from '@/components/site/HeroCinematic';
import StatsBand, { type StatItem } from '@/components/site/StatsBand';
import CategoryRail from '@/components/site/CategoryRail';
import InterviewReel, { type ReelItem } from '@/components/site/InterviewReel';
import MostRead, { type MostReadItem } from '@/components/site/MostRead';
import NewsletterCTA from '@/components/site/NewsletterCTA';
import JoinCTA from '@/components/site/JoinCTA';
import MagneticCTA from '@/components/site/MagneticCTA';
import DistrictMap from '@/components/site/DistrictMap';
import DistrictNewsRail from '@/components/site/DistrictNewsRail';
import VideoReel from '@/components/site/VideoReel';
import '../home.css';

export const revalidate = 60;

// ── Ortak sorgu parçaları ──
const PUB = { status: 'published', deletedAt: null } as const;

// body ve imageUrl (dev base64 data-URI olabilir) ASLA seçilmez — kart satırları hafif kalır;
// görseller /img/[id] endpoint'inden gelir.
const CARD_SELECT = {
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
  videoUrl: true,
  category: { select: { name: true } },
} as const;

// publishedAt=null yayınlanmış satırlar listenin tepesine yapışmasın
const PUB_ORDER = { publishedAt: { sort: 'desc', nulls: 'last' } } as const;

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  imageAlt: string | null;
  imageIsAi: boolean;
  categorySlug: string | null;
  isBreaking: boolean;
  publishedAt: Date | null;
  views: number;
  authorName: string;
  videoUrl: string | null;
  category: { name: string } | null;
};

function toCard(a: ArticleRow): ArticleCardData {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    imageAlt: a.imageAlt,
    imageIsAi: a.imageIsAi,
    categorySlug: a.categorySlug,
    categoryName: a.category?.name ?? null,
    isBreaking: a.isBreaking,
    publishedAt: a.publishedAt,
    views: a.views,
    authorName: a.authorName,
  };
}

function toHero(a: ArticleRow): HeroItem {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    imageAlt: a.imageAlt,
    categoryName: a.category?.name ?? null,
    categorySlug: a.categorySlug,
    dateLabel: a.publishedAt ? formatDateTr(a.publishedAt) : '',
    isBreaking: a.isBreaking,
  };
}

type HomeData = {
  settings: SiteSettings;
  hero: HeroItem[];
  latest: ArticleCardData[];
  rails: { slug: string; name: string; color: string | null; articles: ArticleCardData[] }[];
  interviews: ReelItem[];
  mostRead: MostReadItem[];
  stats: { articleCount: number; totalViews: number; categoryCount: number };
  /** Yayınlanan haber sayısı — ilçe slug'ı → adet (ilçe haritası rozetleri) */
  districtCounts: Record<string, number>;
};

const EMPTY_DATA: HomeData = {
  settings: DEFAULT_SITE_SETTINGS,
  hero: [],
  latest: [],
  rails: [],
  interviews: [],
  mostRead: [],
  stats: { articleCount: 0, totalViews: 0, categoryCount: 0 },
  districtCounts: {},
};

async function getHomeData(): Promise<HomeData> {
  try {
    const [settings, featured, latest, navCats, interviews, mostRead, articleCount, viewsAgg, categoryCount, districtGroups] =
      await Promise.all([
        getSiteSettings(),
        prisma.siteArticle.findMany({
          where: { ...PUB, isFeatured: true },
          orderBy: PUB_ORDER,
          take: 5,
          select: CARD_SELECT,
        }),
        prisma.siteArticle.findMany({
          where: PUB,
          orderBy: PUB_ORDER,
          take: 9,
          select: CARD_SELECT,
        }),
        prisma.siteCategory.findMany({
          where: { showInNav: true },
          orderBy: { order: 'asc' },
          select: { slug: true, name: true, color: true },
        }),
        prisma.siteArticle.findMany({
          where: { ...PUB, categorySlug: 'roportajlar' },
          orderBy: PUB_ORDER,
          take: 6,
          select: CARD_SELECT,
        }),
        prisma.siteArticle.findMany({
          where: { ...PUB, views: { gt: 0 } },
          orderBy: { views: 'desc' },
          take: 5,
          select: CARD_SELECT,
        }),
        prisma.siteArticle.count({ where: PUB }),
        prisma.siteArticle.aggregate({ where: PUB, _sum: { views: true } }),
        prisma.siteCategory.count(),
        // İlçe başına yayınlanan haber sayısı — ilçe haritası rozetleri
        prisma.siteArticle.groupBy({
          by: ['district'],
          where: PUB,
          _count: { _all: true },
        }),
      ]);

    // groupBy sonucunu ilçe slug'ı → adet sözlüğüne indir
    const districtCounts: Record<string, number> = {};
    for (const g of districtGroups) {
      if (g.district) districtCounts[g.district] = g._count._all;
    }

    // Manşet: öne çıkanlar yetmezse en yeni haberlerle 5'e tamamla
    let heroRows: ArticleRow[] = featured;
    if (heroRows.length < 5) {
      const fill = await prisma.siteArticle.findMany({
        where: { ...PUB, id: { notIn: heroRows.map(h => h.id) } },
        orderBy: PUB_ORDER,
        take: 5 - heroRows.length,
        select: CARD_SELECT,
      });
      heroRows = [...heroRows, ...fill];
    }

    // Kategori rayları: nav'daki her kategori için ≥3 haber varsa
    // (röportajlar zaten kendi sinematik bölümünde — InterviewReel — sergileniyor)
    const railCats = navCats.filter(c => c.slug !== 'roportajlar');
    const railArticles = await Promise.all(
      railCats.map(c =>
        prisma.siteArticle.findMany({
          where: { ...PUB, categorySlug: c.slug },
          orderBy: PUB_ORDER,
          take: 8,
          select: CARD_SELECT,
        })
      )
    );
    const rails = railCats
      .map((c, i) => ({
        slug: c.slug,
        name: c.name,
        color: c.color,
        articles: railArticles[i].map(toCard),
      }))
      .filter(r => r.articles.length >= 3);

    return {
      settings,
      hero: heroRows.map(toHero),
      latest: latest.map(toCard),
      rails,
      interviews: interviews.map(a => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        imageAlt: a.imageAlt,
        videoUrl: a.videoUrl,
        publishedAt: a.publishedAt,
      })),
      mostRead: mostRead.map(a => ({
        slug: a.slug,
        title: a.title,
        views: a.views,
        categoryName: a.category?.name ?? null,
      })),
      stats: {
        articleCount,
        totalViews: viewsAgg._sum.views ?? 0,
        categoryCount,
      },
      districtCounts,
    };
  } catch {
    // DB boş/erişilemez olsa da anasayfa zarifçe ayakta kalır
    return EMPTY_DATA;
  }
}

export default async function HomePage() {
  const data = await getHomeData();

  const stats: StatItem[] = [
    { label: 'Yayınlanan Haber', value: data.stats.articleCount },
    { label: 'Toplam Görüntülenme', value: data.stats.totalViews, suffix: '+' },
    { label: 'Kategori', value: data.stats.categoryCount },
    { label: 'Kuruluş', value: 2024, format: 'plain' },
  ];

  return (
    <>
      {/* 1 — Sinematik manşet */}
      <HeroCinematic items={data.hero} kinetic />

      {/* 2 — İstatistik bandı */}
      {data.stats.articleCount > 0 && <StatsBand stats={stats} />}

      {/* 3 — Son haber akışı */}
      {data.latest.length > 0 && (
        <section className="s-section home-latest">
          {/* Opsiyonel aurora (yalnız motion tier full + reduced-motion kapalı iken canlanır) */}
          <div className="s-aurora" aria-hidden="true" />
          <div className="s-container">
            <div className="s-section-head s-reveal" data-reveal="left">
              <div>
                <span className="s-kicker">Güncel Akış</span>
                <h2 className="s-section-title">
                  Çanakkale&apos;de Neler <span className="tick">Oluyor?</span>
                </h2>
              </div>
            </div>
            <div className="home-grid" data-reveal-stagger="90">
              {data.latest.map((article, i) => (
                <ArticleCard key={article.slug} article={article} revealDelay={Math.min(i * 60, 480)} />
              ))}
            </div>
            {/* Birincil CTA — manyetik (pointer:fine + motion full iken çekim; aksi halde normal buton) */}
            <div className="s-reveal home-latest-cta" data-reveal="scale">
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

      {/* 3.5 — İlçenden haberler (yalnız ziyaretçi "Benim İlçem"i seçtiyse görünür) */}
      <DistrictNewsRail />

      {/* 4 — Kategori rayları */}
      {data.rails.map(rail => (
        <CategoryRail
          key={rail.slug}
          slug={rail.slug}
          title={rail.name}
          color={rail.color}
          articles={rail.articles}
        />
      ))}

      {/* 4.5 — İlçe İlçe Çanakkale (interaktif harita) */}
      {data.stats.articleCount > 0 && (
        <section className="s-section home-map">
          <div className="s-container">
            <div className="s-section-head s-reveal" data-reveal="right">
              <div>
                <span className="s-kicker">Şehrin Haritası</span>
                <h2 className="s-section-title">
                  İlçe İlçe <span className="tick">Çanakkale</span>
                </h2>
              </div>
            </div>
            <DistrictMap counts={data.districtCounts} />
          </div>
        </section>
      )}

      {/* 5 — Sokak röportajları */}
      <InterviewReel articles={data.interviews} />

      {/* 5b — Video haberler (varsa; kendi verisini çeker) */}
      <VideoReel />

      {/* 6 — En çok okunanlar */}
      <MostRead items={data.mostRead} />

      {/* 7 — Bülten */}
      <NewsletterCTA adsNotice={data.settings.adsNotice} />

      {/* 8 — Ekibimize katıl bandı */}
      <JoinCTA />
    </>
  );
}
