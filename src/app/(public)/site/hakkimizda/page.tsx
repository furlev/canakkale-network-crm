import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import prisma from '@/lib/prisma';
import {
  getSiteSettings,
  getSiteTeam,
  stripHtml,
  type SiteStatItem,
  type SiteTeamGroup,
} from '@/lib/site';
import { sanitizeHtml } from '@/lib/sanitize';
import '@/app/(public)/pages.css';

/**
 * Hakkımızda — tasarımlı kurumsal sayfa.
 * İçerik (varsa) SitePage slug='hakkimizda' kaydından gelir; ekip vitrini
 * Site Yönetimi > Ekip (Setting 'siteTeam') gruplarından, o boşsa künye
 * sayfasındaki "Rol: Ad" satırlarından sezgisel olarak türetilir.
 */

export const revalidate = 300;

const SITE_URL = 'https://canakkale.network';
const PUB = { status: 'published', deletedAt: null } as const;

const getPage = cache(async (slug: string) => {
  try {
    const page = await prisma.sitePage.findUnique({ where: { slug } });
    return page && page.status === 'published' ? page : null;
  } catch {
    return null;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage('hakkimizda');
  const title = page?.seoTitle || 'Hakkımızda';
  const description =
    page?.metaDescription ||
    (page ? stripHtml(page.content, 160) : 'Çanakkale Network kimdir? Şehrin dijital meydanını kuran ekibi ve yayın anlayışımızı tanıyın.');
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/hakkimizda` },
    openGraph: {
      title: `${title} — Çanakkale Network`,
      description,
      url: `${SITE_URL}/hakkimizda`,
      siteName: 'Çanakkale Network',
      locale: 'tr_TR',
    },
  };
}

/** Eski WP sitesine giden mutlak linkleri iç linke çevirir (görüntüleme katmanı). */
function localizeWpLinks(html: string): string {
  return html.replace(
    /href="https?:\/\/(?:www\.)?canakkale\.network(\/[^"]*)?"/gi,
    (_m, path: string | undefined) => `href="${path || '/'}"`
  );
}

/** Rol tarafında bir unvan kokusu arar — "Marka — Slogan" satırlarını elemek için. */
const ROLE_HINT =
  /(yönetmen|müdür|editör|muhabir|yazar|sahib|koordinatör|sorumlu|tasarım|kamera|kurgu|sosyal medya|yayın|haber|grafik|yazılım|geliştir|danışman|başkan|direktör|prodüktör|spiker|foto|stajyer|saha|ekip|lider)/i;

/** İletişim/adres satırları üye değildir. */
const CONTACT_ROLE =
  /^(iletişim|e-?posta|mail|telefon|tel|faks|fax|adres|web ?site|url|instagram|facebook|twitter|x|youtube|tiktok|webmaster|tekzip)/i;

/** İsim tarafı makul mü? (e-posta, URL, rakam, adres, boş tire değil) */
function plausibleName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 60) return false;
  if (/^[—–\-\s.·]*$/.test(name)) return false; // "—" placeholder satırları
  if (/[@/,]|https?:|www\.|\d/.test(name)) return false;
  return true;
}

/**
 * Künye HTML'inden ekip üyelerini sezgisel ayrıştırır:
 * h2/h3/h4 → grup başlığı; tablo satırlarında <td>Rol</td><td>Ad</td>;
 * li/p satırlarında "Rol: Ad" / "Rol – Ad" desenleri. E-posta, telefon,
 * adres ve "Marka — Slogan" tarzı satırlar elenir.
 */
function parseKunyeTeam(html: string): SiteTeamGroup[] {
  const groups: SiteTeamGroup[] = [];
  const orphan: SiteTeamGroup = { title: 'Künye', members: [] };
  let current: SiteTeamGroup | null = null;

  const push = (role: string, name: string) => {
    role = role.trim();
    name = name.trim();
    if (!role || role.length > 60 || CONTACT_ROLE.test(role)) return;
    if (!plausibleName(name)) return;
    (current ?? orphan).members.push({ name, role });
  };

  const blocks = html.matchAll(/<(h2|h3|h4|li|p|tr)\b[^>]*>([\s\S]*?)<\/\1>/gi);
  for (const [, tag, inner] of blocks) {
    if (/^h[234]$/i.test(tag)) {
      const title = stripHtml(inner, 80);
      if (title && !/künye/i.test(title)) {
        current = { title, members: [] };
        groups.push(current);
      }
      continue;
    }

    if (/^tr$/i.test(tag)) {
      // Tablo satırı: ilk hücre rol, ikinci hücre ad
      const cells = [...inner.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c =>
        stripHtml(c[1], 120)
      );
      if (cells.length >= 2) push(cells[0], cells[1]);
      continue;
    }

    const text = stripHtml(inner, 300);
    if (!text) continue;
    // "Rol: Ad" her zaman; tireli ayraçlarda rol tarafında unvan kokusu şart
    // (yoksa "Çanakkale Network — Şehrin Dijital Meydanı" gibi satırlar üye sanılır)
    const m = text.match(/^(.{2,60}?)(\s*:\s*|\s*[–—]\s*|\s+-\s+)(.+)$/);
    if (!m) continue;
    const [, role, sep, name] = m;
    if (!sep.includes(':') && !ROLE_HINT.test(role)) continue;
    push(role, name);
  }

  const result = groups.filter(g => g.members.length > 0);
  if (orphan.members.length > 0) result.unshift(orphan);
  return result;
}

/** Ad soyaddan avatar baş harfleri (Türkçe büyük harf kurallı). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toLocaleUpperCase('tr-TR');
}

async function getAboutData() {
  const [settings, page, kunyePage, team] = await Promise.all([
    getSiteSettings(),
    getPage('hakkimizda'),
    getPage('kunye'),
    getSiteTeam(),
  ]);

  // Rakam vitrini: manuel mod doluysa CRM'den; değilse DB'den otomatik
  let stats: SiteStatItem[] = [];
  if (settings.statsMode === 'manual' && settings.statsManual.length > 0) {
    stats = settings.statsManual;
  } else {
    try {
      const [articleCount, viewsAgg, categoryCount] = await Promise.all([
        prisma.siteArticle.count({ where: PUB }),
        prisma.siteArticle.aggregate({ where: PUB, _sum: { views: true } }),
        prisma.siteCategory.count(),
      ]);
      if (articleCount > 0) {
        stats = [
          { label: 'Yayınlanan Haber', value: articleCount },
          { label: 'Toplam Görüntülenme', value: viewsAgg._sum.views ?? 0, suffix: '+' },
          { label: 'Kategori', value: categoryCount },
          { label: 'Kuruluş', value: 2024, format: 'plain' },
        ];
      }
    } catch {
      stats = [];
    }
  }

  // Ekip: önce CRM vitrini, boşsa künyeden sezgisel ayrıştırma
  let teamGroups = team.groups.filter(g => g.members.length > 0);
  if (teamGroups.length === 0 && kunyePage) {
    teamGroups = parseKunyeTeam(kunyePage.content);
  }

  return { settings, page, stats, teamGroups };
}

const VALUES: { icon: 'check' | 'pulse' | 'compass'; title: string; text: string }[] = [
  {
    icon: 'check',
    title: 'Teyitli Habercilik',
    text: 'Her haber yayına çıkmadan önce doğrulama sürecinden geçer; hız hiçbir zaman doğruluğun önüne geçmez.',
  },
  {
    icon: 'pulse',
    title: 'Şehrin Nabzı',
    text: 'Sokak röportajlarından kampüs gündemine, iskeleden stadyuma — Çanakkale nerede konuşuyorsa oradayız.',
  },
  {
    icon: 'compass',
    title: 'Bağımsız Yayın',
    text: 'Gündemi kimseden değil, şehirden alırız. Okurumuza karşı sorumluyuz; tekzip ve düzeltme haktır.',
  },
];

function ValueIcon({ name }: { name: 'check' | 'pulse' | 'compass' }) {
  switch (name) {
    case 'check':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'pulse':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
        </svg>
      );
    case 'compass':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
        </svg>
      );
  }
}

export default async function AboutPage() {
  const { settings, page, stats, teamGroups } = await getAboutData();

  return (
    <div>
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">Çanakkale Network</span>
          <h1 className="p-page-title">
            Hakkımızda<span className="tint">.</span>
          </h1>
          <p className="p-page-sub">{settings.slogan}</p>
        </div>
      </header>

      {/* ── 1. Misyon girişi + değerler + rakamlar ── */}
      <section className="s-section">
        <div className="s-container">
          <p className="p-about-lead s-reveal">
            <strong>{settings.title}</strong>, {settings.description}
          </p>

          <div className="p-values">
            {VALUES.map(v => (
              <div className="p-value-card s-reveal" key={v.title}>
                <span className="glyph" aria-hidden="true">
                  <ValueIcon name={v.icon} />
                </span>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            ))}
          </div>

          {stats.length > 0 && (
            <dl className="p-about-stats s-reveal">
              {stats.map(s => (
                <div className="p-about-stat" key={s.label}>
                  <dd className="value">
                    {s.format === 'plain' ? String(s.value) : s.value.toLocaleString('tr-TR')}
                    {s.suffix && <span className="suffix">{s.suffix}</span>}
                  </dd>
                  <dt className="label">{s.label}</dt>
                </div>
              ))}
            </dl>
          )}

          {/* ── 2. CRM'den düzenlenen içerik (varsa) ── */}
          {page && (
            <div className="p-about-prose">
              <div
                className="prose"
                dangerouslySetInnerHTML={{ __html: localizeWpLinks(sanitizeHtml(page.content)) }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── 3. Ekip vitrini ── */}
      {teamGroups.length > 0 && (
        <section className="s-section" style={{ paddingTop: 0 }}>
          <div className="s-container">
            <div className="s-section-head">
              <div>
                <span className="s-kicker">Ekip</span>
                <h2 className="s-section-title">
                  Bu hikâyeyi yazanlar<span className="tick">.</span>
                </h2>
              </div>
            </div>

            {teamGroups.map(group => (
              <div className="p-team-group" key={group.title}>
                <h3 className="p-team-group-title">{group.title}</h3>
                <div className="p-team-grid">
                  {group.members.map(member => (
                    <div className="p-member-card s-reveal" key={`${group.title}-${member.name}-${member.role}`}>
                      <span className="p-avatar" aria-hidden="true">
                        {member.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.photoUrl} alt="" loading="lazy" />
                        ) : (
                          initials(member.name)
                        )}
                      </span>
                      <span className="name">{member.name}</span>
                      <span className="role">{member.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ marginTop: 'clamp(28px, 4vw, 44px)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/ekibimize-katil" className="s-btn s-btn-primary">
                Sen de aramıza katıl
              </Link>
              <Link href="/iletisim" className="s-btn">
                Bize ulaş
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
