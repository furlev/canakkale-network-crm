import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { upsertNewsFromWpPost, WpPost } from '@/lib/wordpress';
import { notify } from '@/lib/notify';

/**
 * WordPress → CRM webhook'u. Eklenti, webhook URL'sine yayın olaylarını POST'lar.
 * WP yönetim panelinde webhook URL'si şöyle ayarlanmalı:
 *   https://<crm-adresi>/api/webhooks/wordpress?secret=<WEBHOOK_SECRET>
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Geçersiz webhook secret' }, { status: 401 });
  }

  try {
    const payload = await request.json();

    if (payload.event === 'post_published' && payload.post) {
      const result = await upsertNewsFromWpPost(payload.post as WpPost);
      await notify('news', `WordPress'te yayınlandı: ${(payload.post as WpPost).title}`, '/news');
      return NextResponse.json({ ok: true, action: result });
    }

    if (payload.event === 'post_status_changed' && payload.post_id) {
      const existing = await prisma.news.findUnique({ where: { wpId: Number(payload.post_id) } });
      if (existing) {
        await prisma.news.update({
          where: { wpId: Number(payload.post_id) },
          data: {
            status: payload.new_status === 'publish' ? 'published' : 'draft',
          },
        });
        return NextResponse.json({ ok: true, action: 'status_updated' });
      }
      return NextResponse.json({ ok: true, action: 'ignored_unknown_post' });
    }

    return NextResponse.json({ ok: true, action: 'ignored_event' });
  } catch (error) {
    console.error('[webhook/wordpress]', error);
    return NextResponse.json({ error: 'Webhook işlenemedi' }, { status: 500 });
  }
}
