import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import {
  aiEnabled, factCheckTopic, writeArticleFromTopic, analyzeArticle,
  getStyleGuide, textOriginalityScore,
} from '@/lib/ai';
import { computeQualityScore } from '@/lib/draft-quality';
import { normalizeDistrict } from '@/lib/districts';
import { stripHtml } from '@/lib/site';

export const maxDuration = 300;

/**
 * POST /api/ai/drafts/[id]/rewrite — taslağı konudan YENİDEN üret.
 * Oturumlu (ekip lideri/yönetici). Yayınlanmış taslak yeniden yazılmaz.
 *
 * Akış: (opsiyonel) fact-check ile taze doğrulanmış özet + kaynak → writeArticleFromTopic
 * → analyzeArticle (SEO/etiket/varyant) → kalite/özgünlük yeniden hesaplanır. Görsel
 * KORUNUR (metin yeniden yazımı görsel maliyeti doğurmaz). Durum 'pending'e çekilir ki
 * editör yeniden denetlesin.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');
    if (!(await aiEnabled())) throw new ApiError(400, 'AI yapılandırılmamış (Vertex/Gemini anahtarı yok).');

    const { id } = await context.params;
    const draft = await prisma.aiDraft.findUnique({ where: { id } });
    if (!draft) throw new ApiError(404, 'Taslak bulunamadı');
    if (draft.status === 'published') throw new ApiError(400, 'Yayınlanmış taslak yeniden yazılamaz.');

    const headline = draft.title || draft.topic;
    const category = draft.category || 'Gündem';
    const styleGuide = await getStyleGuide().catch(() => null);

    // Taze fact-check (grounding) — başarısız/boşsa mevcut gövdeyi taban al.
    let verifiedSummary = '';
    let confidence = draft.confidence ?? null;
    let sourceCount = draft.sourceCount ?? null;
    let contradictions: string[] = [];
    let groundingLinks: string[] = [];
    try {
      const fc = await factCheckTopic(draft.topic, headline);
      verifiedSummary = fc.verifiedSummary || '';
      confidence = fc.confidence;
      sourceCount = fc.sourceCount;
      contradictions = fc.contradictions;
      groundingLinks = fc.groundingLinks;
    } catch {
      /* fact-check başarısız → mevcut içeriği taban al */
    }
    if (!verifiedSummary.trim()) {
      verifiedSummary = stripHtml(draft.body || draft.topic, 6000);
    }

    // Özgün metni yeniden yaz + SEO analizi
    const article = await writeArticleFromTopic(headline, verifiedSummary, category, styleGuide);
    let seo: Awaited<ReturnType<typeof analyzeArticle>> | null = null;
    try { seo = await analyzeArticle(article.title, article.body); } catch { seo = null; }

    // Kalite/özgünlük yeniden hesapla
    const originalityScore = textOriginalityScore(article.body, `${headline}\n${verifiedSummary}`);
    const hasContradiction = contradictions.length > 0;
    const district = normalizeDistrict(seo?.district) || draft.district || null;
    const hasImage = !!draft.imageUrl;
    const fields = [
      !!article.title, !!article.body, !!(seo?.category || draft.category),
      !!(seo?.tags && seo.tags.length), !!seo?.seoTitle, !!seo?.metaDescription,
      !!seo?.socialPost, hasImage,
    ];
    const fieldFullness = fields.filter(Boolean).length / fields.length;
    const qualityScore = computeQualityScore({
      confidence: confidence ?? 0,
      sourceCount: sourceCount ?? 0,
      hasContradiction,
      fieldFullness,
      originalityScore,
    });

    // Kaynakları birleştir: mevcut string linkler + yeni grounding + meta nesneleri korunur
    let existing: unknown[] = [];
    try {
      const p = JSON.parse(draft.sources || '[]');
      if (Array.isArray(p)) existing = p;
    } catch { /* bozuk → yoksay */ }
    const links = new Set<string>();
    const metaObjs: unknown[] = [];
    for (const s of existing) {
      if (typeof s === 'string') links.add(s);
      else metaObjs.push(s);
    }
    for (const l of groundingLinks) links.add(l);
    const sources = JSON.stringify([...[...links].slice(0, 8), ...metaObjs]);

    // Redaksiyon notuna yeniden yazım izi ekle (mevcut notu koru)
    const stamp = `🔄 AI ile yeniden yazıldı (${new Date().toLocaleString('tr-TR')}).`;
    const editorNote = draft.editorNote ? `${stamp} ${draft.editorNote}` : stamp;

    const updated = await prisma.aiDraft.update({
      where: { id },
      data: {
        title: seo?.seoTitle || article.title,
        body: article.body,
        category: seo?.category || draft.category,
        tags: seo?.tags && seo.tags.length ? JSON.stringify(seo.tags) : draft.tags,
        seoTitle: seo?.seoTitle || draft.seoTitle,
        metaDescription: seo?.metaDescription || draft.metaDescription,
        socialPost: seo?.socialPost || draft.socialPost,
        titleVariants: seo?.titleVariants && seo.titleVariants.length ? JSON.stringify(seo.titleVariants) : draft.titleVariants,
        sources,
        confidence,
        sourceCount,
        hasContradiction,
        qualityScore,
        originalityScore,
        district,
        editorNote,
        status: 'pending',
        reviewerId: null,
        reviewerName: null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Taslak yeniden yazılamadı');
  }
}
