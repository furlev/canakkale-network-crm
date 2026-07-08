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
};

const EMPTY_DATA: HomeData = {
  settings: DEFAULT_SITE_SETTINGS,
  hero: [],
  latest: [],
  rails: [],
  interviews: [],
  mostRead: [],
  stats: { articleCount: 0, totalViews: 0, categoryCount: 0 },
};

async function getHomeData(): Promise<HomeData> {
  try {
    const [settings, featured, latest, navCats, interviews, mostRead, articleCount, viewsAgg, categoryCount] =
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
      ]);

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
      <HeroCinematic items={data.hero} />

      {/* 2 — İstatistik bandı */}
      {data.stats.articleCount > 0 && <StatsBand stats={stats} />}

      {/* 3 — Son haber akışı */}
      {data.latest.length > 0 && (
        <section className="s-section home-latest">
          <div className="s-container">
            <div className="s-section-head s-reveal">
              <div>
                <span className="s-kicker">Güncel Akış</span>
                <h2 className="s-section-title">
                  Çanakkale&apos;de Neler <span className="tick">Oluyor?</span>
                </h2>
              </div>
            </div>
            <div className="home-grid">
              {data.latest.map((article, i) => (
                <ArticleCard key={article.slug} article={article} revealDelay={Math.min(i * 60, 480)} />
              ))}
            </div>
          </div>
        </section>
      )}

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

      {/* 5 — Sokak röportajları */}
      <InterviewReel articles={data.interviews} />

      {/* 6 — En çok okunanlar */}
      <MostRead items={data.mostRead} />

      {/* 7 — Bülten */}
      <NewsletterCTA adsNotice={data.settings.adsNotice} />

      {/* 8 — Ekibimize katıl bandı */}
      <JoinCTA />
    </>
  );
}
