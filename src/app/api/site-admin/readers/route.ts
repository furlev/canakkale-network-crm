import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Okuyucu (site üyesi) yönetimi (W2-B, panel). requireLevel('B').
 * GET — okuyucu listesi + plan sayıları.
 * PATCH — bir okuyucuyu premium'a yükselt / free'ye indir (ödeme sağlayıcı
 * entegrasyonu env-gated STUB olduğundan premium elle buradan verilir).
 */

const patchSchema = z.object({
  id: z.string().min(1).max(64),
  action: z.enum(['premium', 'free']),
  months: z.coerce.number().int().min(1).max(60).optional(), // premium süresi (ay); yoksa 1
});

export async function GET() {
  try {
    await requireLevel('B');
    const [readers, grouped] = await Promise.all([
      prisma.siteReader.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          premiumUntil: true,
          confirmedAt: true,
          createdAt: true,
        },
      }),
      prisma.siteReader.groupBy({ by: ['plan'], _count: { _all: true } }),
    ]);

    const counts: Record<string, number> = { free: 0, premium: 0 };
    for (const g of grouped) counts[g.plan] = g._count._all;

    return NextResponse.json({ items: readers, counts });
  } catch (error) {
    return handleApiError(error, 'Okuyucular alınamadı');
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, patchSchema);

    const reader = await prisma.siteReader.findUnique({
      where: { id: body.id },
      select: { id: true, email: true },
    });
    if (!reader) throw new ApiError(404, 'Okuyucu bulunamadı');

    let data: { plan: string; premiumUntil: Date | null };
    if (body.action === 'premium') {
      const months = body.months ?? 1;
      const until = new Date();
      until.setMonth(until.getMonth() + months);
      data = { plan: 'premium', premiumUntil: until };
    } else {
      data = { plan: 'free', premiumUntil: null };
    }

    const updated = await prisma.siteReader.update({
      where: { id: reader.id },
      data,
      select: { id: true, email: true, name: true, plan: true, premiumUntil: true },
    });

    await audit(
      session,
      'updated',
      'siteReader',
      updated.id,
      body.action === 'premium'
        ? `Okuyucu premium yapıldı (${body.months ?? 1} ay): ${updated.email}`
        : `Okuyucu premium'dan düşürüldü: ${updated.email}`,
    );

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Okuyucu güncellenemedi');
  }
}
