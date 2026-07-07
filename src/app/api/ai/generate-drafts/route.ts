import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { safeEqual } from '@/lib/secure';
import { ingestAllSources, recentUnusedItems } from '@/lib/newsfeed';
import {
  discoverTopics, factCheckTopic, writeArticleFromTopic, generateArticleImage, analyzeArticle, aiEnabled,
} from '@/lib/ai';

export const maxDuration = 300; // boru hattı uzun sürebilir

/** Hem oturumlu (lider/yönetici) hem cron (Bearer CRON_SECRET) çağırabilir. */
async function authorize(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && safeEqual(auth, `Bearer ${process.env.CRON_SECRET}`)) return true;
  const session = await getSession();
  return isLeaderOrAdmin(session);
}

// Modül düzeyi kilit: aynı instance'ta eşzamanlı iki üretim koşusunu engeller
// (cron + elle tetikleme çakışması). Çok-instance ortamda instance başına geçerlidir.
let generateRunning = false;

export async function POST(request: Request) {
  if (generateRunning) {
    return NextResponse.json({ error: 'Üretim zaten çalışıyor' }, { status: 429 });
  }
  generateRunning = true;
  try {
    if (!(await authorize(request))) throw new ApiError(403, 'Yetkisiz');
    if (!(await aiEnabled())) throw new ApiError(400, 'AI yapılandırılmamış (Vertex/Gemini)');

    const url = new URL(request.url);
    const maxDrafts = Math.min(Math.max(parseInt(url.searchParams.get('count') || '3', 10) || 3, 1), 6);
    const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '0.55') || 0.55;
    const withImage = url.searchParams.get('image') !== '0';

    // 1) kaynakları topla
    const ingest = await ingestAllSources();
    // 2) son, kullanılmamış öğeler
    const items = await recentUnusedItems(3, 120);
    if (items.length === 0) {
      return NextResponse.json({ ok: true, message: 'İşlenecek yeni haber yok', ingest, created: [] });
    }
    // 3) konu bul + puanla (tek AI çağrısı — hata olursa tüm istek 500 olmasın, ingest korunsun)
    let topics: Awaited<ReturnType<typeof discoverTopics>> = [];
    try {
      topics = await discoverTopics(items.map((i) => ({ title: i.title, link: i.link })), maxDrafts + 2);
    } catch (e) {
      return NextResponse.json({ ok: true, ingest, topicsFound: 0, created: [], skipped: [{ topic: '(konu bulma)', reason: e instanceof Error ? e.message : 'hata' }] });
    }

    const created: { id: string; title: string; confidence: number }[] = [];
    const skipped: { topic: string; reason: string }[] = [];
    const processedLinks = new Set<string>(); // yalnızca gerçekten işlenen konuların kaynak linkleri

    for (const t of topics) {
      if (created.length >= maxDrafts) break;
      for (const l of t.sourceLinks || []) processedLinks.add(l); // bu konu işlendi (drafted ya da skip)
      try {
        // 4) doğruluk kontrolü (grounding)
        const fc = await factCheckTopic(t.topic, t.headline);
        if (fc.confidence < minConfidence) {
          skipped.push({ topic: t.topic, reason: `düşük güven (${fc.confidence.toFixed(2)})` });
          continue;
        }
        // 5) özgün haber yaz
        const article = await writeArticleFromTopic(t.headline, fc.verifiedSummary, t.category);
        // 6) SEO/etiket/kategori/sosyal
        let seo: Awaited<ReturnType<typeof analyzeArticle>> | null = null;
        try { seo = await analyzeArticle(article.title, article.body); } catch { seo = null; }
        // 7) "temsili" görsel
        const imageUrl = withImage ? await generateArticleImage(t.headline) : null;
        // 8) onay kuyruğuna taslak
        const draft = await prisma.aiDraft.create({
          data: {
            topic: t.topic,
            title: seo?.seoTitle || article.title,
            body: article.body,
            category: seo?.category || t.category,
            tags: seo?.tags ? JSON.stringify(seo.tags) : null,
            seoTitle: seo?.seoTitle || null,
            metaDescription: seo?.metaDescription || null,
            socialPost: seo?.socialPost || null,
            imageUrl,
            sources: JSON.stringify([...new Set([...(t.sourceLinks || []), ...fc.groundingLinks])].slice(0, 8)),
            confidence: fc.confidence,
            status: 'pending',
          },
        });
        created.push({ id: draft.id, title: draft.title || t.headline, confidence: fc.confidence });
      } catch (e) {
        skipped.push({ topic: t.topic, reason: e instanceof Error ? e.message : 'hata' });
      }
    }

    // 9) YALNIZCA işlenen konulara ait öğeleri işaretle. Diğerleri usedInDraft=false kalır ve
    //    tekrar değerlendirilebilir (recentUnusedItems 3-günlük pencerede doğal olarak eskitir) → veri kaybı yok.
    const usedIds = items.filter((i) => processedLinks.has(i.link)).map((i) => i.id);
    if (usedIds.length > 0) {
      await prisma.feedItem.updateMany({
        where: { id: { in: usedIds } },
        data: { usedInDraft: true },
      });
    }

    return NextResponse.json({ ok: true, ingest, topicsFound: topics.length, created, skipped });
  } catch (error) {
    return handleApiError(error, 'AI taslak üretimi başarısız');
  } finally {
    generateRunning = false;
  }
}
