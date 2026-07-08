import type { Metadata } from 'next';
import { getMarket } from '@/lib/citydata';
import MarketTicker from '@/components/site/panel/MarketTicker';
import RevealInit from '@/components/site/pages/RevealInit';
import '@/app/(public)/pages.css';

export const revalidate = 600; // 10 dk

const SITE_URL = 'https://canakkale.network';

export const metadata: Metadata = {
  title: 'Piyasa — Döviz & Altın',
  description:
    'Güncel dolar (USD), euro (EUR), gram altın ve çeyrek altın fiyatları. Çanakkale Network şehir panosu.',
  alternates: { canonical: `${SITE_URL}/piyasa` },
  openGraph: {
    title: 'Piyasa — Döviz & Altın — Çanakkale Network',
    description: 'Güncel dolar, euro, gram ve çeyrek altın fiyatları.',
    url: `${SITE_URL}/piyasa`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

export default async function PiyasaPage() {
  const market = await getMarket();
  const stale = market ? (Date.now() - new Date(market.fetchedAt).getTime()) / 60000 > 30 : false;

  return (
    <div>
      <RevealInit />
      <header className="p-page-head" style={{ '--head-tint': '#2fb96b' } as React.CSSProperties}>
        <div className="s-container">
          <span className="s-kicker" style={{ color: '#2fb96b' }}>
            Şehir Panosu
          </span>
          <h1 className="p-page-title">
            Piyasa
            <span className="tint">.</span>
          </h1>
          <p className="p-page-sub">Güncel döviz ve altın fiyatları — gün boyu düzenli güncellenir.</p>
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          <MarketTicker data={market} stale={stale} />
        </div>
      </section>
    </div>
  );
}
