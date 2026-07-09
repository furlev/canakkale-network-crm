import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Lora } from 'next/font/google';
import prisma from '@/lib/prisma';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SITE_SETTINGS,
  getSiteSettings,
  timeAgoTr,
  type SiteSettings,
} from '@/lib/site';
import SiteHeader, { type NavCategory } from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import BreakingTicker, { type TickerItem } from '@/components/site/BreakingTicker';
import EmergencyBanner from '@/components/site/EmergencyBanner';
import Reveal from '@/components/site/Reveal';
import MotionProvider from '@/components/site/motion/MotionProvider';
import CityBar from '@/components/site/panel/CityBar';
import CookieConsent from '@/components/site/CookieConsent';
import CursorGlow from '@/components/site/CursorGlow';
import PushPrompt from '@/components/site/PushPrompt';
import './site.css';
import './home.css'; // header/footer/kabuk stilleri tum site rotalarinda gecerli

// ── Fontlar: Türkçe karakterler için latin-ext şart ──
const fontDisplay = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  display: 'swap',
});

const fontSerif = Lora({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://canakkale.network'),
  title: {
    default: 'Çanakkale Network — Şehrin Dijital Meydanı',
    template: '%s | Çanakkale Network',
  },
  description: DEFAULT_SITE_SETTINGS.description,
  applicationName: 'Çanakkale Network',
  // i18n iskele (W3-C): hreflang alternatifleri. İçerik çevirisi henüz yok;
  // 'en' rotası ileride devreye alınınca gerçek sayfaya bağlanacak (placeholder).
  alternates: {
    canonical: '/',
    languages: { 'tr-TR': '/', en: '/en' },
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'Çanakkale Network',
    url: 'https://canakkale.network',
    title: 'Çanakkale Network — Şehrin Dijital Meydanı',
    description: DEFAULT_SITE_SETTINGS.description,
    images: [{ url: '/site/logo-light.png', alt: 'Çanakkale Network' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Çanakkale Network — Şehrin Dijital Meydanı',
    description: DEFAULT_SITE_SETTINGS.description,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#070d18',
};

// FOUC önleyici: hydration'dan önce kayıtlı temayı uygular (varsayılan: network/koyu)
const THEME_SCRIPT = `(function(){try{if(localStorage.getItem('site-theme')==='truva'){document.documentElement.setAttribute('data-site-theme','truva');}}catch(e){}})();`;

type LayoutData = {
  settings: SiteSettings;
  navCategories: NavCategory[];
  ticker: TickerItem[];
};

async function getLayoutData(): Promise<LayoutData> {
  try {
    const [settings, cats] = await Promise.all([
      getSiteSettings(),
      prisma.siteCategory.findMany({
        where: { showInNav: true },
        orderBy: { order: 'asc' },
        select: { slug: true, name: true },
      }),
    ]);

    let ticker: TickerItem[] = [];
    if (settings.tickerEnabled) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const breaking = await prisma.siteArticle.findMany({
        where: {
          status: 'published',
          deletedAt: null,
          isBreaking: true,
          publishedAt: { gte: since },
        },
        orderBy: { publishedAt: 'desc' },
        take: 10,
        select: { slug: true, title: true, publishedAt: true, category: { select: { color: true } } },
      });
      ticker = breaking.map(b => ({
        slug: b.slug,
        title: b.title,
        timeAgo: b.publishedAt ? timeAgoTr(b.publishedAt) : '',
        color: b.category?.color ?? undefined,
      }));
    }

    const navCategories: NavCategory[] = (cats.length > 0 ? cats : DEFAULT_CATEGORIES).map(c => ({
      slug: c.slug,
      name: c.name,
    }));

    return { settings, navCategories, ticker };
  } catch {
    // DB erişilemese bile site iskeleti ayakta kalsın
    return {
      settings: DEFAULT_SITE_SETTINGS,
      navCategories: DEFAULT_CATEGORIES.map(c => ({ slug: c.slug, name: c.name })),
      ticker: [],
    };
  }
}

export default async function PublicSiteLayout({ children }: { children: React.ReactNode }) {
  const { settings, navCategories, ticker } = await getLayoutData();

  return (
    <html
      lang="tr"
      data-site-theme="network"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontSerif.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="site-body s-grain">
        <MotionProvider>
          <Reveal />
          <CursorGlow />
          <a href="#icerik" className="skip-link">
            İçeriğe atla
          </a>
          {/* Acil durum bandı (deprem vb.) — en üstte, BreakingTicker'dan ÖNCE. active değilse null. */}
          <EmergencyBanner />
          {settings.tickerEnabled && <BreakingTicker items={ticker} />}
          <SiteHeader categories={navCategories} />
          <CityBar />
          <main id="icerik">{children}</main>
          <SiteFooter settings={settings} />
          <CookieConsent />
          <PushPrompt />
        </MotionProvider>
      </body>
    </html>
  );
}
