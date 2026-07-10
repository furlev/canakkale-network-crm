import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import prisma from '@/lib/prisma';
import { formatDateTr, stripHtml } from '@/lib/site';
import { sanitizeHtml } from '@/lib/sanitize';
import '@/app/(public)/pages.css';

/**
 * Statik site sayfaları (hakkımızda, künye, sözleşmeler, KVKK, çerez politikası...).
 * İçerik CRM'deki Site Yönetimi > Sayfalar modülünden düzenlenir (SitePage).
 * Not: Next statik segmentleri (haber, kategori, haberler...) her zaman önce
 * eşler; bu catch-all yalnızca kalan slug'ları yakalar.
 */

export const revalidate = 300;

const SITE_URL = 'https://canakkale.network';

const getPage = cache(async (slug: string) => {
  try {
    const page = await prisma.sitePage.findUnique({ where: { slug } });
    return page && page.status === 'published' ? page : null;
  } catch {
    return null;
  }
});

/**
 * WP'den taşınan içeriklerdeki mutlak canakkale.network linklerini iç linke
 * çevirir — hiçbir sözleşme/sayfa eski WordPress sitesine gitmesin.
 * Görüntüleme katmanında, sanitizeHtml SONRASI uygulanır (sanitize çıktısı
 * daima çift tırnaklı attribute üretir).
 */
function localizeWpLinks(html: string): string {
  return html.replace(
    /href="https?:\/\/(?:www\.)?canakkale\.network(\/[^"]*)?"/gi,
    (_m, path: string | undefined) => `href="${path || '/'}"`
  );
}

export async function generateMetadata(context: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await context.params;
  const page = await getPage(slug);
  if (!page) return { title: 'Sayfa bulunamadı' };

  const title = page.seoTitle || page.title;
  const description = page.metaDescription || stripHtml(page.content, 160);
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/${page.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${page.slug}`,
      siteName: 'Çanakkale Network',
      locale: 'tr_TR',
    },
  };
}

export default async function StaticPage(context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <div>
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">Çanakkale Network</span>
          <h1 className="p-page-title">
            {page.title}
            <span className="tint">.</span>
          </h1>
          <p className="p-page-sub">Son güncelleme: {formatDateTr(page.updatedAt)}</p>
        </div>
      </header>

      <div className="p-static-body">
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: localizeWpLinks(sanitizeHtml(page.content)) }}
        />
      </div>
    </div>
  );
}
