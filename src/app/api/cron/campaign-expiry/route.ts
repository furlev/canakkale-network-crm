import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';
import { notify, nextNumber } from '@/lib/notify';

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
    let invoiced = 0;
    for (const c of active) {
      if (!c.endDate) continue;
      if (c.endDate < now) {
        await prisma.adCampaign.update({ where: { id: c.id }, data: { status: 'ended' } });
        await notify('contract', `Kampanya süresi doldu: ${c.name}${c.advertiser ? ` (${c.advertiser.company})` : ''}`, '/campaigns');
        ended++;

        // ── Gelir → finans ──
        // Tamamlanan kampanyanın harcaması reklamverene yazılır. NOT: AdEvent'te
        // birim maliyet (CPM/CPC) alanı yok; parasal harcama kampanya BÜTÇESİNDEN
        // türetilir (tamamlanmış kampanya bütçesi kadar harcanmış sayılır). AdEvent
        // yalnız teslim ölçümü (gösterim/tık) için sayılır — public raporda gösterilir.
        if (c.advertiserId && c.budget > 0) {
          try {
            await prisma.advertiser.update({
              where: { id: c.advertiserId },
              data: { totalSpent: { increment: c.budget } },
            });
            // Aynı kampanya için tekrar fatura kesme (idempotent güvenlik)
            const dupe = await prisma.invoice.findFirst({
              where: { advertiserId: c.advertiserId, notes: { contains: c.id } },
              select: { id: true },
            });
            if (!dupe) {
              const last = await prisma.invoice.findFirst({ orderBy: { createdAt: 'desc' }, select: { invoiceNo: true } });
              const total = await prisma.invoice.count();
              await prisma.invoice.create({
                data: {
                  invoiceNo: nextNumber(last?.invoiceNo, 'INV', 4, total),
                  amount: c.budget,
                  currency: 'TRY',
                  status: 'unpaid',
                  advertiserId: c.advertiserId,
                  notes: `Reklam kampanyası tamamlandı: ${c.name} (kampanya #${c.id})`,
                },
              });
              invoiced++;
            }
          } catch (e) {
            console.error('[campaign-expiry] gelir/fatura yazımı başarısız', e);
          }
        }
      } else if (c.endDate <= soon) {
        const days = Math.ceil((c.endDate.getTime() - now.getTime()) / 86400000);
        await notify('contract', `Kampanya bitişine ${days} gün: ${c.name}${c.advertiser ? ` (${c.advertiser.company})` : ''}`, '/campaigns');
        warned++;
      }
    }

    return NextResponse.json({ ok: true, warned, ended, invoiced });
  } catch (error) {
    return handleApiError(error, 'Kampanya kontrolü başarısız');
  }
}
