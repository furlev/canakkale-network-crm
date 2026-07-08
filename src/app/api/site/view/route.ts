import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';

/**
 * Halka açık görüntülenme sayacı (proxy'de public + IP rate-limitli).
 * Haber bulunamazsa sessizce ok:false döner — istemci tarafını kırmayız.
 */

const viewSchema = z.object({
  slug: z.string().min(1).max(120),
});

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, viewSchema);
    try {
      await prisma.siteArticle.update({
        where: { slug: body.slug },
        data: { views: { increment: 1 } },
      });
      return NextResponse.json({ ok: true });
    } catch {
      // Slug yok / silinmiş — sayaç kritik değil, sessizce geç
      return NextResponse.json({ ok: false });
    }
  } catch (error) {
    return handleApiError(error, 'Görüntülenme kaydedilemedi');
  }
}
