import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site';
import { sanitizeHtml } from '@/lib/sanitize';
import '@/app/(public)/pages.css';

export const revalidate = 300;

const SITE_URL = 'https://canakkale.network';

export const metadata: Metadata = {
  title: 'İletişim',
  description:
    'Çanakkale Network ile iletişime geçin — haber ihbarı, iş birliği, reklam ve tekzip talepleri.',
  alternates: { canonical: `${SITE_URL}/iletisim` },
  openGraph: {
    title: 'İletişim — Çanakkale Network',
    description: 'Haber ihbarı, iş birliği, reklam ve tekzip talepleri için bize ulaşın.',
    url: `${SITE_URL}/iletisim`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  x: 'X (Twitter)',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

export default async function ContactPage() {
  const settings = await getSiteSettings();

  // Varsa CRM'den düzenlenen ek "iletisim" sayfa içeriği
  let extra: { title: string; content: string } | null = null;
  try {
    const page = await prisma.sitePage.findUnique({ where: { slug: 'iletisim' } });
    if (page && page.status === 'published') extra = { title: page.title, content: page.content };
  } catch {
    extra = null;
  }

  const socials = Object.entries(settings.social).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== ''
  );

  return (
    <div>
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">Bize Ulaşın</span>
          <h1 className="p-page-title">
            İletişim<span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            Haber ihbarı mı var? İş birliği mi düşünüyorsun? Yoksa bir düzeltme mi gerekiyor? Doğru
            adres aşağıda.
          </p>
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          <div className="p-contact-grid">
            <div className="p-contact-card">
              <span className="glyph" aria-hidden="true">
                ✉️
              </span>
              <h2>Genel İletişim</h2>
              <p className="note">Haber ihbarı, iş birliği, reklam ve tüm genel sorular için.</p>
              <a className="mail" href={`mailto:${settings.contactEmail}`}>
                {settings.contactEmail}
              </a>
            </div>
            <div className="p-contact-card">
              <span className="glyph" aria-hidden="true">
                🛠️
              </span>
              <h2>Webmaster</h2>
              <p className="note">Site ile ilgili teknik sorunlar ve geri bildirimler için.</p>
              <a className="mail" href={`mailto:${settings.webmasterEmail}`}>
                {settings.webmasterEmail}
              </a>
            </div>
            <div className="p-contact-card">
              <span className="glyph" aria-hidden="true">
                ⚖️
              </span>
              <h2>Tekzip</h2>
              <p className="note">
                Tekzip talepleri için — yayınlanmış bir haberle ilgili düzeltme ve cevap hakkı
                başvurularınızı bu adrese iletin.
              </p>
              <a className="mail" href={`mailto:${settings.tekzipEmail}`}>
                {settings.tekzipEmail}
              </a>
            </div>
          </div>

          <div className="p-contact-info">
            <span>📍 {settings.address}</span>
            {socials.length > 0 && (
              <div className="p-social" aria-label="Sosyal medya hesaplarımız">
                {socials.map(([key, url]) => (
                  <a key={key} href={url} target="_blank" rel="noopener noreferrer">
                    {SOCIAL_LABELS[key] || key} ↗
                  </a>
                ))}
              </div>
            )}
          </div>

          {extra && (
            <div className="p-static-body" style={{ paddingBottom: 0 }}>
              <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(extra.content) }} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
