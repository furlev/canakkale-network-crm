import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';

/**
 * Arama önerisi (autocomplete) — halka açık; proxy'de public + okuma rate-limitli.
 *
 * Hafif ve hızlı: başlık öneki (prefix) öncelikli, ardından başlık içi geçiş.
 * İlk 8 sonuç; yalnızca yayınlanmış/silinmemiş. Gövde/görsel ASLA seçilmez.
 *
 * q < 2 karakter → boş liste (gereksiz sorgu yok). GRACEFUL: hata yerine boş döner.
 */

export const dynamic = 'force-dynamic';

const TAKE = 8;

export async function GET(request: Request) {
  try {
    const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 80);
    if (q.length < 2) return NextResponse.json({ items: [] });

    // Prefix eşleşmeleri önce (daha alakalı), sonra başlık içi geçişler.
    const [prefix, contains] = await Promise.all([
      prisma.siteArticle.findMany({
        where: { status: 'published', deletedAt: null, title: { startsWith: q, mode: 'insensitive' } },
        orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
        take: TAKE,
        select: { slug: true, title: true, category: { select: { name: true } } },
      }),
      prisma.siteArticle.findMany({
        where: { status: 'published', deletedAt: null, title: { contains: q, mode: 'insensitive' } },
        orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
        take: TAKE,
        select: { slug: true, title: true, category: { select: { name: true } } },
      }),
    ]);

    // Prefix + contains'i birleştir, slug'a göre tekilleştir, prefix'i öne al.
    const seen = new Set<string>();
    const merged: { slug: string; title: string; categoryName: string | null }[] = [];
    for (const a of [...prefix, ...contains]) {
      if (seen.has(a.slug)) continue;
      seen.add(a.slug);
      merged.push({ slug: a.slug, title: a.title, categoryName: a.category?.name ?? null });
      if (merged.length >= TAKE) break;
    }

    return NextResponse.json({ items: merged });
  } catch (error) {
    return handleApiError(error, 'Öneri alınamadı');
  }
}
