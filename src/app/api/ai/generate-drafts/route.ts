import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { safeEqual } from '@/lib/secure';
import { ingestAllSources, recentUnusedItems, clusterRecentItems, SOURCE_TRUST_SELECT, normalizeLink } from '@/lib/newsfeed';
import {
  discoverTopics, factCheckTopic, writeArticleFromTopic, chooseArticleImage, analyzeArticle, aiEnabled, writeWeeklyRoundup,
  summarizeEngagement, getStyleGuide, getAutoPublishConfig, textOriginalityScore, type AutoPublishConfig,
} from '@/lib/ai';
import { budgetStatus } from '@/lib/ai-usage';
import type { StyleGuide } from '@/lib/ai-templates';
import { computeQualityScore } from '@/lib/draft-quality';
import { normalizeDistrict } from '@/lib/districts';

export const maxDuration = 300; // boru hattı uzun sürebilir

/**
 * AI taslak üretimi — ÜÇ KATMAN (mode):
 *   - breaking : son dakika radarı. Son 90 dk'da yayınlanan öğelerde önce UCUZ keyword
 *                ön-filtresi (AI çağrısı yok); eşleşme yoksa maliyet ~0 ile döner.
 *                Görsel üretimi atlanır (hız+maliyet), max 2 konu, güven eşiği DÜŞÜRÜLMEZ.
 *   - daily    : mevcut günlük davranış (3x/gün cron).
 *   - weekly   : haftalık panorama — son 7 günde SİTEDE yayınlanan haberlerden tek AI
 *                çağrısıyla "Çanakkale'de Bu Hafta" değerlendirme yazısı.
 * Her modda çıktı 'pending' AiDraft'tır — otomatik yayın YOK, /ai-news onay kuyruğu esastır.
 */

type Mode = 'breaking' | 'daily' | 'weekly';

/** Hem oturumlu (lider/yönetici) hem cron (Bearer CRON_SECRET) çağırabilir. */
async function authorize(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && safeEqual(auth, `Bearer ${process.env.CRON_SECRET}`)) return true;
  const session = await getSession();
  return isLeaderOrAdmin(session);
}

// ── Son dakika keyword ön-filtresi (AI'sız, ekonomik radar) ──
// Küçük-harf (TR locale) normalize edilmiş başlıkta kök/kalıp arar. Kasıtlı olarak
// ASCII'ye indirgeme YAPILMAZ: "öldü" → "oldu" dönüşümü sahte pozitif üretirdi.
const BREAKING_PATTERNS: RegExp[] = [
  /yangın/, /deprem/, /patlama|patlad[ıi]/, /operasyon/, /gözaltı/, /tutukla/,
  /\bkaza(?![nm])/, // kaza, kazada, kazası... — "kazan(dı/an)" hariç
  /öldür/, /\böl(dü|üm)/, /hayatını kaybet/, /can kaybı/, /cansız beden/, /cinayet/, /intihar/,
  /yaralı/, /yaralan/, /boğ(ul|du)/, /göçük/, /silahl[ıi]|silahla|ateş açıl/, /bıçak/, /kavga/,
  /fırtına/, /\bsel\b|sel bask|sel felaket/, /tahliye/, /çarpış/, /zehirlen/,
  /kayıp/, /(yangın|sel|bomba|tsunami) alarm/, /\bacil/, /son dakika/, /facia/, /feci\b/,
];

function isBreakingTitle(title: string): boolean {
  const t = (title || '').toLocaleLowerCase('tr-TR');
  return BREAKING_PATTERNS.some((re) => re.test(t));
}

// Modül düzeyi kilit: aynı instance'ta eşzamanlı iki üretim koşusunu engeller
// (cron + elle tetikleme çakışması). Çok-instance ortamda instance başına geçerlidir.
let generateRunning = false;

type FeedItems = Awaited<ReturnType<typeof recentUnusedItems>>;
type DraftStats = {
  topicsFound: number;
  created: { id: string; title: string; confidence: number; quality: number; originality: number | null; status: string }[];
  skipped: { topic: string; reason: string }[];
};

/** Ortak taslak üretim hattı: konu bul → (yerel filtre) → fact-check → yaz → SEO →
 *  (ops.) görsel → kalite skoru → pending taslak. Kaynak güveni + çoklu-kaynak teyidi
 *  konu seçimine, fact-check v2 + kalite skoru taslağa işlenir. */
async function produceDrafts(
  items: FeedItems,
  opts: {
    maxDrafts: number; maxTopics: number; minConfidence: number; withImage: boolean;
    newsType: 'breaking' | 'daily'; discoverInstruction?: string;
    styleGuide?: StyleGuide | null; autoPublish?: AutoPublishConfig;
  },
): Promise<DraftStats> {
  // Çoklu-kaynak teyidi: aynı kümedeki (aynı olay) FARKLI kaynak sayısını hesapla
  const clusterSources = new Map<string, Set<string>>();
  for (const i of items) {
    if (!i.clusterId) continue;
    const set = clusterSources.get(i.clusterId) ?? new Set<string>();
    if (i.sourceId) set.add(i.sourceId);
    clusterSources.set(i.clusterId, set);
  }
  const confirmedOf = (i: FeedItems[number]) => (i.clusterId ? (clusterSources.get(i.clusterId)?.size ?? 1) : 1);

  // Gerçek foto sourcing: normalize link → feed öğesi (kaynak türü + mediaUrl ile).
  // "İzin" telif politikası gereği YALNIZCA kendi/yerel kaynakların (official|local) sağladığı
  // görsel kullanılır; agregatör/sosyal (Google News vb.) fotoğrafın sahibi olmadığından ELENİR.
  const linkToItem = new Map<string, FeedItems[number]>();
  for (const i of items) {
    if (i.link) linkToItem.set(normalizeLink(i.link), i);
  }
  const pickSourcePhoto = (t: Awaited<ReturnType<typeof discoverTopics>>[number]): { url: string; name: string | null } | null => {
    for (const raw of t.sourceLinks || []) {
      if (typeof raw !== 'string') continue;
      const it = linkToItem.get(normalizeLink(raw));
      if (!it || !it.mediaUrl) continue;
      const st = it.source?.sourceType;
      if (st === 'official' || st === 'local') {
        return { url: it.mediaUrl, name: it.sourceName ?? it.source?.district ?? null };
      }
    }
    return null;
  };

  // konu bul + puanla (tek AI çağrısı — hata olursa tüm istek 500 olmasın, ingest korunsun)
  // Her öğeye kaynak güven bağlamı (güven skoru/türü + teyit sayısı) geçir.
  let topics: Awaited<ReturnType<typeof discoverTopics>> = [];
  try {
    topics = await discoverTopics(items.map((i) => ({
      title: i.title,
      link: i.link,
      trust: i.source?.trustScore,
      sourceType: i.source?.sourceType,
      confirmed: confirmedOf(i),
    })), opts.maxTopics, opts.discoverInstruction);
  } catch (e) {
    return { topicsFound: 0, created: [], skipped: [{ topic: '(konu bulma)', reason: e instanceof Error ? e.message : 'hata' }] };
  }

  const created: DraftStats['created'] = [];
  const skipped: DraftStats['skipped'] = [];

  for (const t of topics) {
    if (created.length >= opts.maxDrafts) break;
    // Çanakkale-dışı (yerel değil) konuları fact-check'e GİRMEDEN ele → boşa maliyet önle
    if (t.isLocal === false) {
      skipped.push({ topic: t.topic, reason: 'Çanakkale-dışı (yerel değil)' });
      continue;
    }
    try {
      // doğruluk kontrolü (grounding) — son dakikada da eşik DÜŞÜRÜLMEZ (yanlış alarm en pahalı hatadır)
      const fc = await factCheckTopic(t.topic, t.headline);
      if (fc.confidence < opts.minConfidence) {
        skipped.push({ topic: t.topic, reason: `düşük güven (${fc.confidence.toFixed(2)})` });
        continue;
      }
      // özgün haber yaz (kategori şablonu + editör stil rehberi writeArticleFromTopic içinde)
      const article = await writeArticleFromTopic(t.headline, fc.verifiedSummary, t.category, opts.styleGuide);
      // SEO/etiket/kategori/sosyal
      let seo: Awaited<ReturnType<typeof analyzeArticle>> | null = null;
      try { seo = await analyzeArticle(article.title, article.body); } catch { seo = null; }
      // Yayın görseli: izinli gerçek foto varsa ONU kullan (telif: yalnız official/local),
      // yoksa "temsili" Imagen görseli (kendi görselimize logo filigranı). Breaking'de atlanır.
      const sourcePhoto = pickSourcePhoto(t);
      const chosenImage = opts.withImage
        ? await chooseArticleImage({ prompt: t.headline, sourcePhotoUrl: sourcePhoto?.url, sourceName: sourcePhoto?.name, watermark: true })
        : null;
      const imageUrl = chosenImage?.url ?? null;

      // Özgünlük/intihal: üretilen gövdeyi doğrulanmış özet + başlığa karşı ölç (deterministik)
      const originalityScore = textOriginalityScore(article.body, `${t.headline}\n${fc.verifiedSummary}`);

      // Güven katmanı: ilçe (AI makale > konu), çelişki bayrağı, kalite skoru
      const district = normalizeDistrict(seo?.district) || normalizeDistrict(t.district) || null;
      const hasContradiction = fc.contradictions.length > 0;
      const fields = [
        !!article.title, !!article.body, !!(seo?.category || t.category),
        !!(seo?.tags && seo.tags.length), !!seo?.seoTitle, !!seo?.metaDescription,
        !!seo?.socialPost, !!imageUrl,
      ];
      const fieldFullness = fields.filter(Boolean).length / fields.length;
      const qualityScore = computeQualityScore({
        confidence: fc.confidence,
        sourceCount: fc.sourceCount,
        hasContradiction,
        fieldFullness,
        originalityScore,
      });

      // Otomatik editör notu: düşük özgünlükte uyarı
      const notes: string[] = [];
      if (originalityScore !== null && originalityScore < 40) {
        notes.push(`⚠ Özgünlük düşük (%${originalityScore}): metin kaynak özetine yüksek oranda benziyor; yayından önce yeniden yazım önerilir.`);
      }

      // ── Yarı-otomatik yayın kuralı (yalnız DAILY + kural açık; BREAKING/WEEKLY asla) ──
      // Kural sağlanırsa taslak 'approved' + scheduledAt olur; GERÇEK yayını planlı cron +
      // editör denetimi yapar. Varsayılan KAPALI (CLAUDE.md güvenlik).
      let status = 'pending';
      let scheduledAt: Date | null = null;
      let reviewerName: string | null = null;
      const ap = opts.autoPublish;
      if (
        ap?.enabled && opts.newsType === 'daily' && ap.modes.includes('daily') &&
        fc.confidence >= ap.minConfidence && qualityScore >= ap.minQuality &&
        !hasContradiction && (originalityScore ?? 100) >= ap.minOriginality
      ) {
        status = 'approved';
        scheduledAt = new Date(Date.now() + ap.delayMinutes * 60 * 1000);
        reviewerName = 'Otomatik (kural)';
        notes.push(`🤖 Kural gereği otomatik onaylandı (güven %${Math.round(fc.confidence * 100)}, kalite ${qualityScore}). Planlı yayın: ${scheduledAt.toLocaleString('tr-TR')}. Yayın öncesi editör denetimi önerilir.`);
      }

      // Kaynak linkleri + (varsa) görsel meta (alt/telif atfı). Meta nesnesi url İÇERMEZ;
      // public parseSources ve WP buildSourcesHtml url'siz nesneyi güvenle yok sayar,
      // publishDraftToSite bu metadan görsel alt/atıf çıkarır (SiteArticle.imageAlt).
      const sourceLinks: unknown[] = [...new Set([...(t.sourceLinks || []), ...fc.groundingLinks])].slice(0, 8);
      if (chosenImage) {
        sourceLinks.push({ meta: 'image', alt: seo?.imageAlt || null, credit: chosenImage.credit, isAi: chosenImage.isAi });
      }

      // onay kuyruğuna taslak (kural kapalıysa status 'pending' — otomatik yayın YOK)
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
          titleVariants: seo?.titleVariants && seo.titleVariants.length ? JSON.stringify(seo.titleVariants) : null,
          imageUrl,
          sources: JSON.stringify(sourceLinks),
          confidence: fc.confidence,
          status,
          scheduledAt,
          reviewerName,
          newsType: opts.newsType,
          district,
          sourceCount: fc.sourceCount,
          hasContradiction,
          qualityScore,
          originalityScore,
          editorNote: notes.length ? notes.join(' ') : null,
        },
      });
      created.push({ id: draft.id, title: draft.title || t.headline, confidence: fc.confidence, quality: qualityScore, originality: originalityScore, status });
    } catch (e) {
      skipped.push({ topic: t.topic, reason: e instanceof Error ? e.message : 'hata' });
    }
  }

  // discoverTopics kendisine verilen TÜM öğe kümesini değerlendirdi; bu yüzden hepsini
  // "işlendi" say. İşaretlemeyi AI'ın döndürdüğü kaynak-link string'ine bağlamak (eski
  // davranış) kırılgandı: AI linki normalize/kısaltıp döndürünce eşleşme kaçar, öğe
  // usedInDraft=false kalır ve her koşuda yeniden işlenip mükerrer taslak + boşa AI
  // maliyeti üretirdi. (discoverTopics baştan hata verirse yukarıda erken dönülür ve
  // hiçbir öğe işaretlenmez → sonraki koşuda yeniden değerlendirilir.)
  const usedIds = items.map((i) => i.id);
  if (usedIds.length > 0) {
    await prisma.feedItem.updateMany({
      where: { id: { in: usedIds } },
      data: { usedInDraft: true },
    });
  }

  return { topicsFound: topics.length, created, skipped };
}

/** mode'u query (?mode=) veya JSON body ({"mode": ...}) üzerinden okur; geçersizse hata. */
async function resolveMode(request: Request, url: URL): Promise<Mode> {
  let raw = url.searchParams.get('mode');
  if (!raw) {
    try {
      const body = await request.json();
      if (body && typeof body.mode === 'string') raw = body.mode;
    } catch { /* body yok/JSON değil → varsayılan */ }
  }
  const mode = (raw || 'daily').toLowerCase();
  if (mode !== 'breaking' && mode !== 'daily' && mode !== 'weekly') {
    throw new ApiError(400, `Geçersiz mode: '${raw}' (breaking | daily | weekly)`);
  }
  return mode as Mode;
}

export async function POST(request: Request) {
  if (generateRunning) {
    return NextResponse.json({ error: 'Üretim zaten çalışıyor' }, { status: 429 });
  }
  generateRunning = true;
  try {
    if (!(await authorize(request))) throw new ApiError(403, 'Yetkisiz');
    if (!(await aiEnabled())) throw new ApiError(400, 'AI yapılandırılmamış (Vertex/Gemini)');

    const url = new URL(request.url);
    const mode = await resolveMode(request, url);
    const maxDrafts = Math.min(Math.max(parseInt(url.searchParams.get('count') || '3', 10) || 3, 1), 6);
    const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '0.55') || 0.55;
    let withImage = url.searchParams.get('image') !== '0';

    // ── WEEKLY: haftalık panorama (feed ingest'ine gerek yok; kaynak = sitede yayınlananlar) ──
    if (mode === 'weekly') {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const articles = await prisma.siteArticle.findMany({
        where: { status: 'published', deletedAt: null, publishedAt: { gte: since } },
        orderBy: { publishedAt: 'desc' },
        take: 60,
        select: {
          slug: true, title: true, summary: true, views: true,
          categorySlug: true, category: { select: { name: true } },
        },
      });
      if (articles.length < 3) {
        return NextResponse.json({ ok: true, mode, articlesConsidered: articles.length, created: [], message: 'Son 7 günde yeterli yayınlanmış haber yok (< 3), haftalık panorama atlandı' });
      }
      const roundup = await writeWeeklyRoundup(articles.map((a) => ({
        title: a.title,
        summary: a.summary,
        category: a.category?.name || a.categorySlug,
        views: a.views,
      })));
      const draft = await prisma.aiDraft.create({
        data: {
          topic: 'Haftalık panorama — Çanakkale\'de Bu Hafta',
          title: roundup.title,
          body: roundup.body,
          category: 'Genel',
          tags: roundup.tags.length > 0 ? JSON.stringify(roundup.tags) : null,
          seoTitle: roundup.seoTitle || null,
          metaDescription: roundup.metaDescription || null,
          socialPost: null,
          imageUrl: null,
          sources: JSON.stringify(articles.slice(0, 8).map((a) => `/haber/${a.slug}`)),
          confidence: null,
          status: 'pending',
          newsType: 'weekly',
        },
      });
      return NextResponse.json({
        ok: true, mode, articlesConsidered: articles.length,
        created: [{ id: draft.id, title: draft.title }], skipped: [],
      });
    }

    // ── BREAKING / DAILY: önce kaynakları topla ──
    const ingest = await ingestAllSources();
    // Çoklu-kaynak teyidi için embedding kümeleme (hata-toleranslı; patlarsa atlanır)
    const cluster = await clusterRecentItems();

    // Günlük bütçe + editör stil rehberi (hepsi hata-toleranslı, asla fırlatmaz)
    const budget = await budgetStatus();
    const styleGuide = await getStyleGuide();
    // Bütçe aşımı: görseli atla (asıl maliyet). Ağır aşımda (>1.5x) üretimi tümden atla.
    if (budget.enabled && budget.exceeded) {
      withImage = false;
      if (budget.spentUsd >= budget.dailyUsd * 1.5) {
        return NextResponse.json({
          ok: true, mode, ingest, cluster, budget, created: [],
          skipped: [{ topic: '(bütçe)', reason: `Günlük AI bütçesi aşıldı ($${budget.spentUsd.toFixed(2)} / $${budget.dailyUsd}) — üretim atlandı` }],
        });
      }
    }

    if (mode === 'breaking') {
      // Son 90 dakikada yayınlanan (pubDate), kullanılmamış öğeler (kaynak güveni join'li)
      const since = new Date(Date.now() - 90 * 60 * 1000);
      const fresh = await prisma.feedItem.findMany({
        where: { usedInDraft: false, pubDate: { gte: since } },
        orderBy: { pubDate: 'desc' },
        take: 60,
        include: { source: SOURCE_TRUST_SELECT },
      });
      // Ucuz keyword ön-filtresi — eşleşme yoksa AI çağrısı YAPMADAN dön (maliyet ~0)
      const matched = fresh.filter((i) => isBreakingTitle(i.title));
      if (matched.length === 0) {
        return NextResponse.json({ ok: true, mode, ingest, cluster, budget, scanned: fresh.length, found: 0, created: [], skipped: [] });
      }
      // Not: BREAKING'e autoPublish GEÇİLMEZ → son dakika taslağı asla otomatik onaylanmaz.
      const stats = await produceDrafts(matched, {
        maxDrafts: 2,
        maxTopics: 2,
        minConfidence, // 0.55 kalır — son dakika yanlışı en pahalı yanlıştır
        withImage: false, // hız + maliyet: editör görselsiz de yayınlar
        newsType: 'breaking',
        discoverInstruction:
          'Bu bir SON DAKİKA radarıdır: yalnızca GERÇEKTEN acil/son-dakika değeri taşıyan olayları seç (yangın, kaza, afet, asayiş olayı, can kaybı vb.). Magazin, rutin duyuru, etkinlik takvimi, açılış/ziyaret haberlerini ELE.',
        styleGuide,
      });
      return NextResponse.json({ ok: true, mode, ingest, cluster, budget, scanned: fresh.length, found: matched.length, ...stats });
    }

    // ── DAILY: mevcut günlük davranış ──
    const items = await recentUnusedItems(3, 120);
    if (items.length === 0) {
      return NextResponse.json({ ok: true, mode, message: 'İşlenecek yeni haber yok', ingest, cluster, budget, created: [] });
    }
    // Geri besleme: okuyucu ilgisini konu seçimine enjekte et + yarı-otomatik yayın kuralı
    const engagement = await summarizeEngagement(30);
    const autoPublish = await getAutoPublishConfig();
    const stats = await produceDrafts(items, {
      maxDrafts,
      maxTopics: maxDrafts + 2,
      minConfidence,
      withImage,
      newsType: 'daily',
      discoverInstruction: engagement || undefined,
      styleGuide,
      autoPublish,
    });
    return NextResponse.json({ ok: true, mode, ingest, cluster, budget, ...stats });
  } catch (error) {
    return handleApiError(error, 'AI taslak üretimi başarısız');
  } finally {
    generateRunning = false;
  }
}
