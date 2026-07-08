import type { Metadata } from 'next';
import { getPrayer } from '@/lib/citydata';
import PrayerCountdown from '@/components/site/panel/PrayerCountdown';
import RevealInit from '@/components/site/pages/RevealInit';
import '@/app/(public)/pages.css';

export const dynamic = 'force-dynamic'; // build'de prerender etme (DATABASE_URL yalnız runtime'da)

const SITE_URL = 'https://canakkale.network';

export const metadata: Metadata = {
  title: 'Namaz Vakitleri',
  description:
    'Çanakkale namaz vakitleri: imsak, güneş, öğle, ikindi, akşam ve yatsı. Sıradaki vakte kalan süre canlı geri sayım ile. Diyanet İşleri (Aladhan) kaynaklı.',
  alternates: { canonical: `${SITE_URL}/namaz` },
  openGraph: {
    title: 'Namaz Vakitleri — Çanakkale Network',
    description: 'Çanakkale namaz vakitleri ve sıradaki vakte canlı geri sayım.',
    url: `${SITE_URL}/namaz`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

export default async function NamazPage() {
  const prayer = await getPrayer();

  return (
    <div>
      <RevealInit />
      <header className="p-page-head" style={{ '--head-tint': '#a3852f' } as React.CSSProperties}>
        <div className="s-container">
          <span className="s-kicker" style={{ color: '#a3852f' }}>
            Şehir Panosu
          </span>
          <h1 className="p-page-title">
            Namaz Vakitleri
            <span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            {prayer
              ? 'Çanakkale için bugünkü namaz vakitleri ve sıradaki vakte kalan süre.'
              : 'Namaz vakitleri hazırlanıyor. Lütfen kısa süre sonra tekrar bakın.'}
          </p>
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          {prayer ? (
            <PrayerCountdown data={prayer} />
          ) : (
            <div className="p-empty">
              <span className="glyph" aria-hidden="true">🕌</span>
              <h2>Vakitler henüz yüklenmedi</h2>
              <p>Namaz vakitleri günlük olarak güncellenir. Kaynak geçici olarak erişilemiyor olabilir.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
