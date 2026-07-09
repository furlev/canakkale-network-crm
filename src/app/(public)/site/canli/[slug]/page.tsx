import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import LiveBlogClient, { type LiveEntry } from './LiveBlogClient';
import '@/app/(public)/pages.css';

export const revalidate = 15;

const SITE_URL = 'https://canakkale.network';
const INITIAL_ENTRIES = 60;

const getBlog = cache(async (slug: string) =>
  prisma.liveBlog.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, status: true, articleId: true, updatedAt: true },
  })
);

export async function generateMetadata(context: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await context.params;
  const blog = await getBlog(slug);
  if (!blog) return { title: 'Canlı yayın bulunamadı' };
  const live = blog.status === 'active';
  const title = `${live ? '🔴 CANLI · ' : ''}${blog.title}`;
  const description = live
    ? `${blog.title} — gelişmeler anlık olarak burada. Çanakkale Network canlı yayını.`
    : `${blog.title} — canlı yayın sona erdi. Tüm gelişmeleri geriye dönük okuyabilirsiniz.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/canli/${blog.slug}` },
    openGraph: {
      title: `${blog.title} — Çanakkale Network`,
      description,
      url: `${SITE_URL}/canli/${blog.slug}`,
      siteName: 'Çanakkale Network',
      locale: 'tr_TR',
      type: 'article',
    },
  };
}

export default async function LiveBlogPage(context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const blog = await getBlog(slug);
  if (!blog) notFound();

  const rows = await prisma.liveBlogEntry.findMany({
    where: { liveBlogId: blog.id },
    orderBy: { createdAt: 'desc' },
    take: INITIAL_ENTRIES,
    select: { id: true, body: true, important: true, authorName: true, createdAt: true },
  });

  // Client'e düz (serileştirilebilir) veri geçir — createdAt ISO string
  const initialEntries: LiveEntry[] = rows.map((e) => ({
    id: e.id,
    body: e.body,
    important: e.important,
    authorName: e.authorName,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <div>
      <header className="p-page-head">
        <div className="s-container">
          <span className="s-kicker">{blog.status === 'active' ? 'Canlı Yayın' : 'Canlı Arşiv'}</span>
          <h1 className="p-page-title">
            {blog.title}
            <span className="tint">.</span>
          </h1>
          <p className="p-page-sub">
            {blog.status === 'active'
              ? 'Gelişmeler anlık olarak buraya düşüyor — en yeni giriş en üstte.'
              : 'Bu canlı yayın sona erdi. Aşağıda tüm gelişmeleri geriye dönük okuyabilirsiniz.'}
          </p>
          {blog.articleId && (
            <p style={{ marginTop: '12px' }}>
              <Link className="s-btn" href={`/haber/${blog.articleId}`}>
                İlgili haberi oku →
              </Link>
            </p>
          )}
        </div>
      </header>

      <section className="s-section" style={{ paddingTop: 'clamp(20px, 3vw, 36px)' }}>
        <div className="s-container">
          <LiveBlogClient slug={blog.slug} initialStatus={blog.status} initialEntries={initialEntries} />
        </div>
      </section>
    </div>
  );
}
