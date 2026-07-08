import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';
import { safeEqual } from '@/lib/secure';
import { getTransport } from '@/lib/mailer';
import { getCompanyInfo } from '@/lib/invoice-pdf';

export const maxDuration = 60;

/**
 * Vadesi geçmiş, ödenmemiş faturalar için kibar hatırlatma e-postası gönderir.
 * Hedef: status ∈ {unpaid, overdue} & dueDate < now & (lastReminderAt yok veya > 7 gün önce).
 *   - status 'overdue' yapılır, lastReminderAt damgalanır, reminderCount++.
 *   - Not: 7 günlük tekrar için 'overdue' faturalar da taranır (aksi halde tek hatırlatma
 *     sonrası status unpaid olmaktan çıkacağı için tekrar hiç tetiklenmezdi).
 * `Authorization: Bearer <CRON_SECRET>` ister (safeEqual ile sabit-zamanlı).
 */
export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || !safeEqual(bearer, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const due = await prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { in: ['unpaid', 'overdue'] },
        dueDate: { lt: now },
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: weekAgo } }],
      },
      include: { client: true },
    });

    // SMTP yoksa e-posta atlanır ama durum güncellemesi yine de yapılır.
    let mailer: { transport: Awaited<ReturnType<typeof getTransport>>['transport']; from: string } | null = null;
    let company = { name: 'Çanakkale Network Medya' } as { name: string };
    if (due.length > 0) {
      try {
        mailer = await getTransport();
        company = await getCompanyInfo();
      } catch (e) {
        console.warn('[invoice-reminders] SMTP yapılandırılmadı, yalnızca durum güncellenecek:', (e as Error).message);
      }
    }

    let sent = 0;
    let skipped = 0;
    for (const inv of due) {
      const to = inv.client?.email;
      if (mailer && to) {
        try {
          const amountStr = inv.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const dueStr = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('tr-TR') : '-';
          const greeting = inv.client?.contactName || inv.client?.companyName || 'Sayın Müşterimiz';
          await mailer.transport.sendMail({
            from: mailer.from,
            to,
            subject: `Ödeme Hatırlatması — Fatura ${inv.invoiceNo}`,
            text:
              `Sayın ${greeting},\n\n` +
              `${inv.invoiceNo} numaralı, ${amountStr} ${inv.currency} tutarındaki faturanızın son ödeme tarihi (${dueStr}) geçmiştir.\n` +
              `Ödemenizi en kısa sürede tamamlamanızı rica ederiz. Ödemeyi yaptıysanız bu iletiyi dikkate almayınız.\n\n` +
              `Saygılarımızla,\n${company.name}`,
            html:
              `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6">` +
              `<p>Sayın ${greeting},</p>` +
              `<p><strong>${inv.invoiceNo}</strong> numaralı, <strong>${amountStr} ${inv.currency}</strong> tutarındaki faturanızın son ödeme tarihi (<strong>${dueStr}</strong>) geçmiştir.</p>` +
              `<p>Ödemenizi en kısa sürede tamamlamanızı rica ederiz. Ödemeyi yaptıysanız bu iletiyi dikkate almayınız.</p>` +
              `<p>Saygılarımızla,<br/>${company.name}</p>` +
              `</div>`,
          });
          sent++;
        } catch (e) {
          console.error('[invoice-reminders] gönderilemedi:', inv.invoiceNo, e);
          skipped++;
        }
      } else {
        skipped++;
      }

      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: 'overdue', lastReminderAt: now, reminderCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ ok: true, processed: due.length, sent, skipped });
  } catch (error) {
    return handleApiError(error, 'Fatura hatırlatmaları gönderilemedi');
  }
}
