import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site';
import { sanitizeHtml } from '@/lib/sanitize';
import { isSafeMapsEmbedUrl } from '@/lib/maps-embed';
import ContactForm from './ContactForm';
import CopyButton from './CopyButton';
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

/** Eski WP sitesine giden mutlak linkleri iç linke çevirir (görüntüleme katmanı). */
function localizeWpLinks(html: string): string {
  return html.replace(
    /href="https?:\/\/(?:www\.)?canakkale\.network(\/[^"]*)?"/gi,
    (_m, path: string | undefined) => `href="${path || '/'}"`
  );
}

/** İletişim kartlarının ikonları — stroke tabanlı, tema renklerine uyumlu. */
function CardIcon({ name }: { name: 'mail' | 'wrench' | 'scale' }) {
  switch (name) {
    case 'mail':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'wrench':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case 'scale':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      );
  }
}

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

  const cards: { icon: 'mail' | 'wrench' | 'scale'; title: string; note: string; email: string }[] = [
    {
      icon: 'mail',
      title: 'Genel İletişim',
      note: 'Haber ihbarı, iş birliği, reklam ve tüm genel sorular için.',
      email: settings.contactEmail,
    },
    {
      icon: 'wrench',
      title: 'Webmaster',
      note: 'Site ile ilgili teknik sorunlar ve geri bildirimler için.',
      email: settings.webmasterEmail,
    },
    {
      icon: 'scale',
      title: 'Tekzip',
      note: 'Yayınlanmış bir haberle ilgili düzeltme ve cevap hakkı başvuruları için.',
      email: settings.tekzipEmail,
    },
  ];

  // GÜVENLİK: iframe src yalnız doğrulanmış Google Maps URL'iyle basılır (stored XSS engeli)
  const hasMap = isSafeMapsEmbedUrl(settings.mapsEmbedUrl);

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
          {/* ── 1. Üç iletişim kanalı ── */}
          <div className="p-contact-grid">
            {cards.map(card => (
              <div className="p-contact-card s-reveal" key={card.title}>
                <span className="glyph" aria-hidden="true">
                  <CardIcon name={card.icon} />
                </span>
                <h2>{card.title}</h2>
                <p className="note">{card.note}</p>
                <div className="p-contact-mailrow">
                  <a className="mail" href={`mailto:${card.email}`}>
                    {card.email}
                  </a>
                  <CopyButton text={card.email} />
                </div>
              </div>
            ))}
          </div>

          {/* ── 2. Form (sol) + harita (sağ) ── */}
          <div className={`p-contact-layout${hasMap ? '' : ' no-map'}`}>
            <ContactForm />
            {hasMap && (
              <div className="p-map-frame s-reveal" data-reveal="right">
                <iframe
                  src={settings.mapsEmbedUrl}
                  title="ÇOMÜ İletişim Fakültesi"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <span className="p-map-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {settings.address}
                </span>
              </div>
            )}
          </div>

          {/* ── 3. CRM'den düzenlenen ek içerik (varsa) ── */}
          {extra && (
            <div className="p-about-prose">
              <div
                className="prose"
                dangerouslySetInnerHTML={{ __html: localizeWpLinks(sanitizeHtml(extra.content)) }}
              />
            </div>
          )}

          {/* ── 4. Adres + sosyal medya şeridi ── */}
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
        </div>
      </section>
    </div>
  );
}
