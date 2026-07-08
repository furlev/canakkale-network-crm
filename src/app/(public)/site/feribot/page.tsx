import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { getWeather } from '@/lib/citydata';
import FerryBoard, { type FerryTrip, type SeaState } from '@/components/site/panel/FerryBoard';
import RevealInit from '@/components/site/pages/RevealInit';
import '@/app/(public)/pages.css';

export const dynamic = 'force-dynamic'; // build'de prerender etme (DATABASE_URL yalnız runtime'da)

const SITE_URL = 'https://canakkale.network';

export const metadata: Metadata = {
  title: 'Feribot Saatleri',
  description:
    'Çanakkale feribot ve vapur sefer saatleri: Çanakkale-Eceabat, Çanakkale-Kilitbahir, Gelibolu-Lapseki ve Bozcaada/Gökçeada hatları. Sıradaki sefer ve boğaz deniz durumu.',
  alternates: { canonical: `${SITE_URL}/feribot` },
  openGraph: {
    title: 'Feribot Saatleri — Çanakkale Network',
    description: 'Çanakkale feribot sefer saatleri, sıradaki sefer geri sayımı ve boğaz deniz durumu.',
    url: `${SITE_URL}/feribot`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

/** Weather cache'inden boğaz deniz durumunu (dalga/rüzgâr) çıkarır. */
async function getSeaState(): Promise<SeaState> {
  try {
    const weather = await getWeather();
    if (!weather) return null;
    // Boğaz kıyısındaki ilk kıyı ilçesini tercih et (Merkez → Eceabat → Gelibolu)
    const pref = ['merkez', 'eceabat', 'gelibolu'];
    const districts = weather.districts;
    const d =
      pref.map((s) => districts.find((x) => x.slug === s && x.coastal)).find(Boolean) ||
      districts.find((x) => x.coastal);
    if (!d) return null;
    return { wave: d.days?.[0]?.waveMax ?? null, wind: d.current?.windSpeed ?? null };
  } catch {
    return null;
  }
}

export default async function FeribotPage() {
  let trips: FerryTrip[] = [];
  try {
    const rows = await prisma.ferrySchedule.findMany({
      where: { active: true },
      orderBy: [{ route: 'asc' }, { departTime: 'asc' }],
    });
    trips = rows.map((r) => ({
      id: r.id,
      route: r.route,
      departTime: r.departTime,
      days: r.days,
      operator: r.operator,
      season: r.season,
    }));
  } catch {
    // DB erişilemezse boş pano
  }

  const sea = await getSeaState();

  return (
    <div>
      <RevealInit />
      <header className="p-page-head" style={{ '--head-tint': '#2f7db9' } as React.CSSProperties}>
        <div className="s-container">
          <span className="s-kicker" style={{ color: '#2f7db9' }}>
            Şehir Panosu
          </span>
          <h1 className="p-page-title">
            Feribot Saatleri
            <span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            {trips.length > 0
              ? 'Çanakkale hatlarında sıradaki sefer ve günün tam tarifesi. Saatler bilgilendirme amaçlıdır; resmi teyit için işletmeye danışın.'
              : 'Feribot tarifesi hazırlanıyor. Saatler yönetim tarafından girildiğinde burada görünecek.'}
          </p>
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          {trips.length > 0 ? (
            <FerryBoard trips={trips} sea={sea} />
          ) : (
            <div className="p-empty">
              <span className="glyph" aria-hidden="true">⛴️</span>
              <h2>Tarife henüz yok</h2>
              <p>Feribot sefer saatleri en kısa sürede eklenecek. Bu arada diğer şehir servislerimize göz atabilirsin.</p>
              <a className="s-btn s-btn-primary" href="/hava">Hava Durumu</a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
