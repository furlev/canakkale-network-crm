import Link from 'next/link';
import type { SiteSettings } from '@/lib/site';

const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: '/hakkimizda', label: 'Hakkımızda' },
  { href: '/kunye', label: 'Künye' },
  { href: '/sozlesmeler', label: 'Sözleşmeler' },
  { href: '/gizlilik-ve-guvenlik-politikasi', label: 'Gizlilik ve Güvenlik Politikası' },
  { href: '/cerez-politikasi', label: 'Çerez Politikası' },
  { href: '/kisisel-verilerin-korunmasi-kanunu-kvkk', label: 'KVKK Aydınlatma Metni' },
  { href: '/site-kullanim-kosullari', label: 'Site Kullanım Koşulları' },
  { href: '/iletisim', label: 'İletişim' },
];

function SocialIcon({ name }: { name: 'facebook' | 'x' | 'instagram' | 'youtube' | 'tiktok' }) {
  switch (name) {
    case 'facebook':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" />
        </svg>
      );
    case 'x':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.291 19.491h2.039L6.486 3.24H4.298l13.312 17.404Z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'youtube':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" />
        </svg>
      );
  }
}

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  x: 'X (Twitter)',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

/**
 * Site alt bilgisi — her iki temada da koyu lacivert zemin.
 */
export default function SiteFooter({ settings }: { settings: SiteSettings }) {
  const socialEntries = (
    Object.entries(settings.social) as [keyof SiteSettings['social'], string | undefined][]
  ).filter((entry): entry is [keyof SiteSettings['social'], string] => Boolean(entry[1]));

  // CRM > Site Yönetimi > Ayarlar'dan gelen kabuk metinleri (boşsa otomatik/varsayılan).
  const copyright =
    settings.copyrightText.trim() ||
    `© ${new Date().getFullYear()} ${settings.title || 'Çanakkale Network'} — Tüm hakları saklıdır.`;
  const credit = settings.footerCredit.trim();

  return (
    <footer className="site-footer">
      <div className="s-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <img src={settings.logoFooter || '/site/logo-dark.png'} alt={settings.title || 'Çanakkale Network'} className="footer-logo" />
            <p className="footer-slogan">{settings.slogan}</p>
            <p className="footer-desc">{settings.description}</p>
            {socialEntries.length > 0 && (
              <div className="footer-social" aria-label="Sosyal medya hesaplarımız">
                {socialEntries.map(([name, url]) => (
                  <a
                    key={name}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-link"
                    aria-label={SOCIAL_LABELS[name] ?? name}
                  >
                    <SocialIcon name={name} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="footer-col">
            <h3 className="footer-col-title">Bize Ulaş</h3>
            <ul className="footer-list">
              <li>
                <span className="footer-list-label">İletişim</span>
                <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
              </li>
              <li>
                <span className="footer-list-label">Webmaster</span>
                <a href={`mailto:${settings.webmasterEmail}`}>{settings.webmasterEmail}</a>
              </li>
              <li>
                <span className="footer-list-label">Tekzip</span>
                <a href={`mailto:${settings.tekzipEmail}`}>{settings.tekzipEmail}</a>
              </li>
              <li>
                <span className="footer-list-label">Adres</span>
                <span>{settings.address}</span>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h3 className="footer-col-title">Kurumsal</h3>
            <nav aria-label="Hukuki sayfalar">
              <ul className="footer-list footer-legal">
                {LEGAL_LINKS.map(link => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="footer-bottom">
          <p>{copyright}</p>
          {credit && (
            <p className="footer-credit">
              <span>{credit}</span>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
