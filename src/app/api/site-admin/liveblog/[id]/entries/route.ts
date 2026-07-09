import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Canlı blog girişleri — hızlı ekleme (POST) + silme (DELETE ?entryId=).
 * requireLevel('B'), audit. 'important' giriş, mevcut web-push ucunu (varsa)
 * best-effort tetikler (yoksa sessizce atlanır — graceful).
 */

const entrySchema = z.object({
  body: z.string().trim().min(1, 'Giriş boş olamaz').max(4000),
  important: z.boolean().optional(),
});

/**
 * 'Önemli' giriş için web push'u best-effort tetikle. /api/site/push/send
 * Bearer CRON_SECRET ister ve /api/site/ altında olduğu için panel host'unda da
 * erişilebilir. CRON_SECRET yoksa veya uç yoksa sessizce atlanır — asıl işlemi bozmaz.
 */
async function bestEffortPush(request: Request, title: string, body: string, slug: string): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return; // yapılandırılmamış → sessizce atla
  try {
    const endpoint = new URL('/api/site/push/send', request.url).toString();
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        title: title.slice(0, 120),
        body: body.replace(/\s+/g, ' ').trim().slice(0, 300),
        url: `/canli/${slug}`,
        tag: `canli-${slug}`,
      }),
    });
  } catch {
    /* push kritik değil — sessiz geç */
  }
}

/** POST — yeni giriş ekle. important ise web push best-effort. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const body = await parseBody(request, entrySchema);

    const blog = await prisma.liveBlog.findUnique({ where: { id }, select: { id: true, slug: true, title: true, status: true } });
    if (!blog) throw new ApiError(404, 'Canlı blog bulunamadı');

    const important = body.important ?? false;
    const created = await prisma.liveBlogEntry.create({
      data: {
        liveBlogId: id,
        body: body.body,
        important,
        authorName: session.name || session.email || null,
      },
    });

    // Yeni giriş → blog updatedAt tazelensin (liste sıralaması için)
    await prisma.liveBlog.update({ where: { id }, data: { updatedAt: new Date() } });

    await audit(session, 'created', 'liveBlogEntry', created.id, `Canlı giriş${important ? ' (önemli)' : ''}: ${blog.title}`);

    // 'Önemli' + yayın aktifse push tetikle (best-effort)
    if (important && blog.status === 'active') {
      await bestEffortPush(request, `Canlı: ${blog.title}`, body.body, blog.slug);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Giriş eklenemedi');
  }
}

/** DELETE — tek giriş sil (?entryId=). */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const entryId = new URL(request.url).searchParams.get('entryId');
    if (!entryId) throw new ApiError(400, 'entryId gerekli');

    const entry = await prisma.liveBlogEntry.findUnique({ where: { id: entryId }, select: { id: true, liveBlogId: true } });
    if (!entry || entry.liveBlogId !== id) throw new ApiError(404, 'Giriş bulunamadı');

    await prisma.liveBlogEntry.delete({ where: { id: entryId } });
    await audit(session, 'deleted', 'liveBlogEntry', entryId, 'Canlı giriş silindi');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'Giriş silinemedi');
  }
}
