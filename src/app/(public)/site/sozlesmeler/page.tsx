import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { formatDateTr, stripHtml } from '@/lib/site';
import '@/app/(public)/pages.css';

/**
 * Sözleşmeler — sitedeki tüm hukuki sayfaların (gizlilik, çerez, KVKK,
 * kullanım koşulları...) tek yerden ulaşılan zarif kart dizini.
 * Eski WP "sözleşmeler" sayfasının bozuk boşluk sorununu kökten çözer:
 * bu statik rota catch-all'dan önce eşleşir.
 */

export const revalidate = 300;

const SITE_URL = 'https://canakkale.network';

export const metadata: Metadata = {
  title: 'Sözleşmeler ve Politikalar',
  description:
    'Çanakkale Network hukuki metinleri: gizlilik ve güvenlik politikası, çerez politikası, KVKK aydınlatma metni ve site kullanım koşulları.',
  alternates: { canonical: `${SITE_URL}/sozlesmeler` },
  openGraph: {
    title: 'Sözleşmeler ve Politikalar — Çanakkale Network',
    description: 'Gizlilik, çerez, KVKK ve kullanım koşulları metinlerine tek yerden ulaşın.',
    url: `${SITE_URL}/sozlesmeler`,
    siteName: 'Çanakkale Network',
    locale: 'tr_TR',
  },
};

/** Footer'daki bilinen hukuki sayfalar — kart sıralaması bu listeyle başlar. */
const KNOWN_LEGAL_SLUGS = [
  'gizlilik-ve-guvenlik-politikasi',
  'cerez-politikasi',
  'kisisel-verilerin-korunmasi-kanunu-kvkk',
  'site-kullanim-kosullari',
];

/** Slug'ında hukuki metin kokusu olan diğer yayınlanmış sayfalar da listeye girer. */
const LEGAL_HINT =
  /(gizlilik|cerez|kvkk|kisisel-veri|kullanim|kosul|sozlesme|politika|aydinlatma|tekzip|telif|yasal)/;

/** Yapısal sayfalar — hukuki dizinde yeri yok. */
const EXCLUDED_SLUGS = new Set(['hakkimizda', 'kunye', 'iletisim', 'sozlesmeler', 'ekibimize-katil']);

type LegalPage = { slug: string; title: string; excerpt: string; updatedAt: Date };

async function getLegalPages(): Promise<LegalPage[]> {
  try {
    const pages = await prisma.sitePage.findMany({
      where: { status: 'published' },
      select: { slug: true, title: true, content: true, updatedAt: true },
    });

    const legal = pages.filter(
      p =>
        !EXCLUDED_SLUGS.has(p.slug) &&
        (KNOWN_LEGAL_SLUGS.includes(p.slug) || LEGAL_HINT.test(p.slug))
    );

    // Bilinen sıra önce, kalanlar alfabetik
    legal.sort((a, b) => {
      const ia = KNOWN_LEGAL_SLUGS.indexOf(a.slug);
      const ib = KNOWN_LEGAL_SLUGS.indexOf(b.slug);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.title.localeCompare(b.title, 'tr');
    });

    return legal.map(p => ({
      slug: p.slug,
      title: p.title,
      excerpt: stripHtml(p.content, 150),
      updatedAt: p.updatedAt,
    }));
  } catch {
    return [];
  }
}

type IconName = 'shield' | 'cookie' | 'lock' | 'scroll' | 'doc';

function iconFor(slug: string): IconName {
  if (/gizlilik|guvenlik/.test(slug)) return 'shield';
  if (/cerez/.test(slug)) return 'cookie';
  if (/kvkk|kisisel-veri|aydinlatma/.test(slug)) return 'lock';
  if (/kullanim|kosul|sozlesme/.test(slug)) return 'scroll';
  return 'doc';
}

function LegalIcon({ name }: { name: IconName }) {
  switch (name) {
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
      );
    case 'cookie':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          <path d="M8.5 8.5v.01" />
          <path d="M16 15.5v.01" />
          <path d="M12 12v.01" />
          <path d="M11 17v.01" />
          <path d="M7 14v.01" />
        </svg>
      );
    case 'lock':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'scroll':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 17V5a2 2 0 0 0-2-2H4" />
          <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
        </svg>
      );
    case 'doc':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      );
  }
}

export default async function LegalIndexPage() {
  const pages = await getLegalPages();

  return (
    <div>
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">Hukuki Metinler</span>
          <h1 className="p-page-title">
            Sözleşmeler<span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            Gizlilikten çerezlere, KVKK'dan kullanım koşullarına — seni ilgilendiren tüm hukuki
            metinler tek sayfada.
          </p>
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          {pages.length > 0 ? (
            <div className="p-legal-grid">
              {pages.map(page => (
                <Link href={`/${page.slug}`} className="p-legal-card s-reveal" key={page.slug}>
                  <span className="glyph" aria-hidden="true">
                    <LegalIcon name={iconFor(page.slug)} />
                  </span>
                  <h2>{page.title}</h2>
                  <span className="date">Son güncelleme: {formatDateTr(page.updatedAt)}</span>
                  {page.excerpt && <p className="excerpt">{page.excerpt}</p>}
                  <span className="cta">Metni oku</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-empty">
              <span className="glyph" aria-hidden="true">
                📄
              </span>
              <h2>Hukuki metinler hazırlanıyor</h2>
              <p>
                Sözleşme ve politika sayfaları çok yakında burada olacak. Sorularınız için bize
                yazabilirsiniz.
              </p>
              <Link href="/iletisim" className="s-btn s-btn-primary">
                İletişime geç
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
