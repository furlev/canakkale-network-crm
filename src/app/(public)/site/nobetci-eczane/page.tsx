import type { Metadata } from 'next';
import { getTodayPharmacies, getPharmacy } from '@/lib/citydata';
import PharmacyCard from '@/components/site/panel/PharmacyCard';
import RevealInit from '@/components/site/pages/RevealInit';
import '@/app/(public)/pages.css';

export const dynamic = 'force-dynamic'; // build'de prerender etme (DATABASE_URL yalnız runtime'da)

const SITE_URL = 'https://canakkale.network';

export const metadata: Metadata = {
  title: 'Nöbetçi Eczaneler',
  description:
    "Çanakkale ve ilçelerinde bugün nöbetçi eczaneler: adres, telefon ve harita konumu. Merkez, Biga, Çan, Gelibolu, Ezine ve tüm ilçeler.",
  alternates: { canonical: `${SITE_URL}/nobetci-eczane` },
  openGraph: {
    title: 'Nöbetçi Eczaneler — Çanakkale Network',
    description: 'Çanakkale ve ilçelerinde bugün nöbetçi eczaneler; adres, telefon ve harita.',
    url: `${SITE_URL}/nobetci-eczane`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

export default async function NobetciEczanePage() {
  const [pharmacy, meta] = await Promise.all([getTodayPharmacies(), getPharmacy()]);

  return (
    <div>
      <RevealInit />
      <header className="p-page-head" style={{ '--head-tint': '#2fb96b' } as React.CSSProperties}>
        <div className="s-container">
          <span className="s-kicker" style={{ color: '#2fb96b' }}>
            Şehir Panosu
          </span>
          <h1 className="p-page-title">
            Nöbetçi Eczaneler
            <span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            {pharmacy.entries.length > 0
              ? `Çanakkale genelinde bugün ${pharmacy.entries.length} nöbetçi eczane açık. İlçe seçerek filtreleyin.`
              : 'Bugünün nöbetçi eczane listesi hazırlanıyor.'}
          </p>
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          <PharmacyCard data={pharmacy} />
          {meta?.lastError && pharmacy.entries.length === 0 && (
            <p style={{ marginTop: 16, color: 'var(--ink-faint)', fontSize: 13 }}>
              Not: Kaynak geçici olarak erişilemiyor olabilir. Lütfen daha sonra tekrar deneyin.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
