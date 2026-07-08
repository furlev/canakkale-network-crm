import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { writeArticleFromTopic, analyzeArticle, AiNotConfiguredError } from '@/lib/ai';
import { audit } from '@/lib/audit';
import { normalizeDistrict } from '@/lib/districts';

/**
 * İhbar → AI haber taslağı. isLeaderOrAdmin (B/A) gerektirir.
 *
 * ai.ts DÜZENLENMEZ; yalnızca `writeArticleFromTopic` + `analyzeArticle` import
 * edilip çağrılır. Üretilen taslak AiDraft(status='pending') olarak onay kuyruğuna
 * (/ai-news) düşer; Tip.draftId bağlanır ve ihbar 'converted' olarak işaretlenir.
 * Taslak ASLA otomatik yayınlanmaz.
 */

export const maxDuration = 120;

/** ai.ts'in (dışa açık olmayan) sanitizeForPrompt'una eşdeğer hafif temizlik:
 *  ihbar metni güvenilmez kullanıcı girdisidir; prompt'a gömmeden önce sınırla. */
function clampForPrompt(s: string | null | undefined, max: number): string {
  // Kontrol karakterlerini (0x00-0x1f, 0x7f) boşluğa indir — kaynak dosyada
  // ham kontrol baytı bulundurmamak için kod-noktası kontrolüyle.
  const cleaned = Array.from(s || '')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code < 32 || code === 127 ? ' ' : ch;
    })
    .join('');
  return cleaned.replace(/```/g, "'''").trim().slice(0, max);
}

export async function POST(request: Request, context: { params: Promise<{ tipId: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) {
      throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');
    }

    const { tipId } = await context.params;
    const tip = await prisma.tip.findUnique({ where: { id: tipId } });
    if (!tip) throw new ApiError(404, 'İhbar bulunamadı');
    if (tip.draftId) throw new ApiError(409, 'Bu ihbardan zaten bir AI taslağı üretildi.');

    // 1) İhbar konusundan özgün haber metni  2) SEO/etiket/sosyal analizi
    const headline = clampForPrompt(tip.subject, 300);
    const summary = clampForPrompt(tip.content, 6000);
    const article = await writeArticleFromTopic(headline, summary, 'Gündem');
    const analysis = await analyzeArticle(article.title, article.body);

    const draft = await prisma.aiDraft.create({
      data: {
        topic: tip.subject,
        title: article.title,
        body: article.body,
        category: analysis.category || 'Gündem',
        tags: JSON.stringify(analysis.tags || []),
        seoTitle: analysis.seoTitle || null,
        metaDescription: analysis.metaDescription || null,
        socialPost: analysis.socialPost || null,
        status: 'pending',
        newsType: 'daily',
        district: normalizeDistrict(tip.content) || normalizeDistrict(tip.subject),
        editorNote: `İhbardan üretildi: ${tip.tipNumber}`,
      },
    });

    // Tip → taslak bağı + durum 'converted'
    await prisma.tip.update({
      where: { id: tip.id },
      data: { draftId: draft.id, status: 'converted' },
    });

    await audit(session, 'created', 'aiDraft', draft.id, `İhbardan AI taslağı üretildi (${tip.tipNumber})`);

    return NextResponse.json({ ok: true, draftId: draft.id, title: draft.title });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'İhbardan taslak üretilemedi');
  }
}
