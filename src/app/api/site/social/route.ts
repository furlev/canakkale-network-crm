import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, getPagination, listResponse } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Çoklu-kanal sosyal yayın kuyruğu — SocialPost CRUD/list.
 *
 * Not: /api/site/ önekinde (proxy'de public + IP rate-limitli) ama rota KENDİ içinde
 * requireLevel('B') ile korunur (defense-in-depth). Oturumsuz istek 401 alır.
 * Gerçek paylaşım manüel yapılır (metin kopyala → işaretle); otomatik gönderim yok.
 */

const PLATFORMS = ['instagram', 'x', 'facebook'] as const;
const STATUSES = ['queued', 'posted', 'skipped'] as const;

const socialCreate = z.object({
  articleId: z.string().optional().nullable(),
  platform: z.enum(PLATFORMS).optional(),
  text: z.string().min(1, 'Metin gerekli').max(5000),
  status: z.enum(STATUSES).optional(),
});

export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const platform = url.searchParams.get('platform');
    const where: { status?: string; platform?: string } = {};
    if (status && (STATUSES as readonly string[]).includes(status)) where.status = status;
    if (platform && (PLATFORMS as readonly string[]).includes(platform)) where.platform = platform;

    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.socialPost.findMany({
        where: Object.keys(where).length ? where : undefined,
        orderBy: { createdAt: 'desc' },
        ...(pagination ?? {}),
      }),
      pagination ? prisma.socialPost.count({ where: Object.keys(where).length ? where : undefined }) : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Sosyal gönderiler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, socialCreate);
    const created = await prisma.socialPost.create({
      data: {
        articleId: body.articleId || null,
        platform: body.platform || 'instagram',
        text: body.text,
        status: body.status || 'queued',
        postedAt: body.status === 'posted' ? new Date() : null,
      },
    });
    await audit(session, 'created', 'socialPost', created.id, `Sosyal gönderi eklendi (${created.platform})`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Sosyal gönderi oluşturulamadı');
  }
}
