import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError, requireLevel } from '@/lib/api';
import { stripHtml } from '@/lib/site';
import { uniqueSiteSlug } from '@/lib/publish-draft';
import { audit } from '@/lib/audit';

const convertSchema = z.object({
  tipId: z.string().min(1),
});

/** Düz metni güvenli HTML paragraflarına çevirir (kaçış + satır→paragraf). */
function textToHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br />')}</p>`)
    .join('\n') || '<p></p>';
}

/**
 * İhbarı canakkale.network sitesinde bir HABER TASLAĞINA dönüştürür (WordPress kaldırıldı).
 * SiteArticle status='draft' olarak oluşturulur; editör /site-yonetimi/haber/[id] üzerinden
 * düzenleyip yayınlar. İhbar 'converted' olarak işaretlenir ve draftId ile bağlanır.
 */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, convertSchema);

    const tip = await prisma.tip.findUnique({ where: { id: body.tipId } });
    if (!tip) throw new ApiError(404, 'İhbar bulunamadı');
    if (tip.status === 'converted') throw new ApiError(409, 'Bu ihbar zaten habere dönüştürülmüş');

    const slug = await uniqueSiteSlug(tip.subject);
    const bodyHtml = textToHtml(tip.content) +
      `\n<p><em>— Kaynak: ${tip.source} (${tip.tipNumber})</em></p>`;

    const article = await prisma.siteArticle.create({
      data: {
        slug,
        title: tip.subject,
        summary: stripHtml(bodyHtml, 180),
        body: bodyHtml,
        status: 'draft',
        newsType: 'manual',
        authorName: session.name || 'Çanakkale Network',
        authorId: session.sub,
      },
    });

    await prisma.tip.update({
      where: { id: tip.id },
      data: { status: 'converted', draftId: article.id },
    });

    await audit(session, 'converted', 'tip', tip.id, `İhbar site haber taslağına dönüştürüldü (${slug}): ${tip.subject}`);

    return NextResponse.json({
      ok: true,
      articleId: article.id,
      slug: article.slug,
      editUrl: `/site-yonetimi/haber/${article.id}`,
      message: 'Site haber taslağı oluşturuldu — düzenleyip yayınlayabilirsiniz',
    });
  } catch (error) {
    return handleApiError(error, 'İhbar habere dönüştürülemedi');
  }
}
