import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';
import { notify } from '@/lib/notify';

/**
 * Bitişine 3 gün ve daha az kalan aktif kampanyalar için bildirim üretir;
 * süresi geçmiş aktif kampanyaları 'ended' yapar. Günlük cron için.
 * `Authorization: Bearer <CRON_SECRET>` ister.
 */
export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || bearer !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 86400000);

    const active = await prisma.adCampaign.findMany({
      where: { status: 'active', endDate: { not: null } },
      include: { advertiser: { select: { company: true } } },
    });

    let warned = 0;
    let ended = 0;
    for (const c of active) {
      if (!c.endDate) continue;
      if (c.endDate < now) {
        await prisma.adCampaign.update({ where: { id: c.id }, data: { status: 'ended' } });
        await notify('contract', `Kampanya süresi doldu: ${c.name}${c.advertiser ? ` (${c.advertiser.company})` : ''}`, '/campaigns');
        ended++;
      } else if (c.endDate <= soon) {
        const days = Math.ceil((c.endDate.getTime() - now.getTime()) / 86400000);
        await notify('contract', `Kampanya bitişine ${days} gün: ${c.name}${c.advertiser ? ` (${c.advertiser.company})` : ''}`, '/campaigns');
        warned++;
      }
    }

    return NextResponse.json({ ok: true, warned, ended });
  } catch (error) {
    return handleApiError(error, 'Kampanya kontrolü başarısız');
  }
}
