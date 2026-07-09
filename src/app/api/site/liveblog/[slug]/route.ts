import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';

/**
 * Canlı blog public poll ucu (halka açık; /api/site/ altında → proxy public + IP rate-limitli).
 * Sadece GET (okuma). İstemci (LiveBlogClient) 10-15 sn'de bir bunu çağırır.
 *
 *  • ?since=<ISO> verilmişse: yalnız o andan itibaren (>=) oluşan girişleri döner.
 *    İstemci en yeni bildiği createdAt'i gönderir; sınır girişi tekrar gelebilir,
 *    istemci id'ye göre dedup yapar (böylece aynı-ms girişler kaçmaz).
 *  • since yoksa: en yeni MAX_ENTRIES giriş (ilk yükleme).
 *
 * Girişler daima yeni→eski sıralı döner (istemci en yeniyi en üste basar).
 * serverTime döndürülür ki istemci sonraki since için sunucu saatini baz alsın.
 */

const MAX_ENTRIES = 200;

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const url = new URL(_request.url);
    const sinceRaw = url.searchParams.get('since');

    const blog = await prisma.liveBlog.findUnique({
      where: { slug },
      select: { id: true, slug: true, title: true, status: true, articleId: true, createdAt: true, updatedAt: true },
    });
    if (!blog) {
      return NextResponse.json({ error: 'Canlı yayın bulunamadı' }, { status: 404 });
    }

    let since: Date | null = null;
    if (sinceRaw) {
      const d = new Date(sinceRaw);
      if (!isNaN(d.getTime())) since = d;
    }

    const entries = await prisma.liveBlogEntry.findMany({
      where: {
        liveBlogId: blog.id,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ENTRIES,
      select: { id: true, body: true, important: true, authorName: true, createdAt: true },
    });

    return NextResponse.json({
      id: blog.id,
      slug: blog.slug,
      title: blog.title,
      status: blog.status,
      articleId: blog.articleId,
      updatedAt: blog.updatedAt,
      serverTime: new Date().toISOString(),
      entries,
    });
  } catch (error) {
    return handleApiError(error, 'Canlı yayın alınamadı');
  }
}
