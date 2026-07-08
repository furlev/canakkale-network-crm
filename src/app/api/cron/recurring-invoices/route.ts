import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hasLevel } from '@/lib/permissions';
import { safeEqual } from '@/lib/secure';
import { nextNumber, notify } from '@/lib/notify';
import { computeInvoiceTotals, type InvoiceItemLike } from '@/lib/invoice-pdf';
import { audit } from '@/lib/audit';

export const maxDuration = 60;

/**
 * Tekrarlayan faturaları materyalize eder: nextRunAt <= now olan AKTİF şablonlar için
 * bir Invoice (+ InvoiceItem) üretir ve nextRunAt'i bir sonraki döneme ilerletir.
 *
 * Erişim: `Authorization: Bearer <CRON_SECRET>` (GitHub Actions) VEYA oturumlu B+
 * (panelden "Bekleyenleri Faturalandır" butonu). Proxy /api/cron/* yolunu pas geçer;
 * rota kendini korur (safeEqual — timing-safe).
 *
 * Not: her şablon için tur başına EN FAZLA bir fatura üretilir; gecikmiş dönemler
 * sonraki cron turlarında yakalanır (geriye dönük fatura yığını oluşmasın diye).
 */

const INTERVAL_LABEL: Record<string, string> = {
  monthly: 'Aylık',
  quarterly: 'Çeyreklik',
  yearly: 'Yıllık',
};

/** nextRunAt'i interval kadar ilerletir (ay/çeyrek/yıl). */
function advance(from: Date, interval: string): Date {
  const d = new Date(from);
  if (interval === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else if (interval === 'quarterly') d.setMonth(d.getMonth() + 3);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function parseItems(json: string | null | undefined): InvoiceItemLike[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v
      .filter((it) => it && typeof it === 'object')
      .map((it) => ({
        description: String(it.description ?? 'Hizmet'),
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        vatRate: Number(it.vatRate) || 0,
      }));
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  // Yetki: cron secret VEYA oturumlu B+
  const session = await getSession();
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const cronOk = !!process.env.CRON_SECRET && safeEqual(bearer, process.env.CRON_SECRET);
  if (!cronOk && !hasLevel(session, 'B')) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const now = new Date();
    const due = await prisma.recurringInvoice.findMany({
      where: { active: true, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: 'asc' },
    });

    const generated: string[] = [];
    const errors: string[] = [];

    for (const tpl of due) {
      try {
        const items = parseItems(tpl.items);
        if (items.length === 0) {
          errors.push(`${tpl.title}: kalem yok, atlandı`);
          // Yine de bir sonraki döneme ilerlet (sonsuz tekrar denemesini önle)
          await prisma.recurringInvoice.update({
            where: { id: tpl.id },
            data: { nextRunAt: advance(tpl.nextRunAt ?? now, tpl.interval) },
          });
          continue;
        }

        const totals = computeInvoiceTotals(items, 0);

        // Fatura no: silmelere dayanıklı, tur başına yeniden hesaplanır
        const [last, count] = await Promise.all([
          prisma.invoice.findFirst({ orderBy: { createdAt: 'desc' }, select: { invoiceNo: true } }),
          prisma.invoice.count(),
        ]);
        const invoiceNo = nextNumber(last?.invoiceNo, 'INV', 4, count);

        const data: Prisma.InvoiceUncheckedCreateInput = {
          invoiceNo,
          amount: totals.amount,
          currency: tpl.currency,
          subtotal: totals.subtotal,
          vatTotal: totals.vatTotal,
          status: 'unpaid',
          clientId: tpl.clientId || null,
          notes: `Tekrarlayan fatura: ${tpl.title}${tpl.notes ? ` — ${tpl.notes}` : ''}`,
          items: {
            create: items.map((it, i) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              vatRate: it.vatRate,
              order: i,
            })),
          },
        };

        const inv = await prisma.invoice.create({ data });
        await prisma.recurringInvoice.update({
          where: { id: tpl.id },
          data: { nextRunAt: advance(tpl.nextRunAt ?? now, tpl.interval) },
        });

        await audit(
          session,
          'created',
          'invoice',
          inv.id,
          `Tekrarlayan faturadan üretildi: ${inv.invoiceNo} (şablon: ${tpl.title}, ${INTERVAL_LABEL[tpl.interval] || tpl.interval})`
        );
        generated.push(inv.invoiceNo);
      } catch (err) {
        errors.push(`${tpl.title}: ${err instanceof Error ? err.message : 'üretilemedi'}`);
      }
    }

    if (generated.length > 0) {
      // 'info' tipi bildirim ayarı toggle'larına takılmaz (yeni/ödenmemiş fatura üretimi)
      await notify('info', `${generated.length} tekrarlayan fatura oluşturuldu`, '/invoices');
    }

    return NextResponse.json({
      ok: true,
      generated: generated.length,
      invoiceNos: generated,
      errors: errors.length ? errors : undefined,
      message: generated.length > 0 ? `${generated.length} fatura üretildi` : 'Vadesi gelen tekrarlayan fatura yok',
    });
  } catch (error) {
    console.error('[cron/recurring-invoices]', error);
    return NextResponse.json({ error: 'Tekrarlayan faturalar işlenemedi' }, { status: 500 });
  }
}
