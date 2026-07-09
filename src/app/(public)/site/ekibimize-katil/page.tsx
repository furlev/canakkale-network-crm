import type { Metadata } from 'next';
import { getJoinForm } from '@/lib/site';
import JoinForm from '@/components/site/pages/JoinForm';
import MagneticCTA from '@/components/site/MagneticCTA';
import '@/app/(public)/pages.css';

export const revalidate = 300;

const SITE_URL = 'https://canakkale.network';

export const metadata: Metadata = {
  title: 'Ekibimize Katıl',
  description:
    'Çanakkale Network büyüyor — muhabirlikten sosyal medyaya, kameradan tasarıma. Şehrin hikâyesini birlikte anlatalım.',
  alternates: { canonical: `${SITE_URL}/ekibimize-katil` },
  openGraph: {
    title: 'Ekibimize Katıl — Çanakkale Network',
    description: 'Şehrin hikâyesini birlikte anlatalım. Başvurunu bırak, seninle iletişime geçelim.',
    url: `${SITE_URL}/ekibimize-katil`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

export default async function JoinPage() {
  const form = await getJoinForm();

  return (
    <div>
      {/* ── Sinematik açılış: abide silueti + dev tipografi ── */}
      <header className="p-join-hero">
        <div className="s-container">
          <span className="s-kicker">Kadromuz Açık</span>
          <h1 className="p-join-title">
            {form.title}
            <span className="tick">.</span>
          </h1>
          <p className="p-page-sub">{form.intro}</p>
          {form.enabled && (
            <div style={{ marginTop: 'clamp(20px, 3vw, 32px)' }}>
              {/* Birincil CTA — manyetik; form bölümüne yumuşak kaydırır */}
              <MagneticCTA href="#basvuru" className="s-btn s-btn-primary">
                Hemen Başvur
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14" />
                  <path d="m6 13 6 6 6-6" />
                </svg>
              </MagneticCTA>
            </div>
          )}
        </div>
      </header>

      <section className="s-section" id="basvuru">
        <div className="s-container">
          {form.enabled ? (
            <JoinForm schema={form} />
          ) : (
            <div className="p-closed">
              <span className="glyph" aria-hidden="true">
                ⏸️
              </span>
              <h2>Başvurular şu an kapalı</h2>
              <p>
                Yeni dönem başvuruları açıldığında burada duyuracağız. Bizi sosyal medyadan takip etmeyi
                unutma!
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
