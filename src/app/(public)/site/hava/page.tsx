import type { Metadata } from 'next';
import { getWeather } from '@/lib/citydata';
import WeatherCard from '@/components/site/panel/WeatherCard';
import RevealInit from '@/components/site/pages/RevealInit';
import '@/app/(public)/pages.css';

export const dynamic = 'force-dynamic'; // build'de prerender etme (DATABASE_URL yalnız runtime'da)

const SITE_URL = 'https://canakkale.network';

export const metadata: Metadata = {
  title: 'Hava Durumu',
  description:
    'Çanakkale ve ilçelerinin güncel hava durumu, 5 günlük tahmin ve kıyı ilçelerde deniz dalga yüksekliği. Merkez, Gökçeada, Gelibolu, Ezine, Ayvacık ve daha fazlası.',
  alternates: { canonical: `${SITE_URL}/hava` },
  openGraph: {
    title: 'Hava Durumu — Çanakkale Network',
    description: 'Çanakkale ve ilçelerinin güncel hava durumu ve 5 günlük tahmini.',
    url: `${SITE_URL}/hava`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

export default async function HavaPage() {
  const weather = await getWeather();

  return (
    <div>
      <RevealInit />
      <header className="p-page-head" style={{ '--head-tint': '#2f7db9' } as React.CSSProperties}>
        <div className="s-container">
          <span className="s-kicker" style={{ color: '#2f7db9' }}>
            Şehir Panosu
          </span>
          <h1 className="p-page-title">
            Hava Durumu
            <span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            Çanakkale ve ilçelerinin anlık durumu ile 5 günlük tahmini. İlçe sekmesinden seçim yapın.
          </p>
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          <WeatherCard data={weather} />
        </div>
      </section>
    </div>
  );
}
