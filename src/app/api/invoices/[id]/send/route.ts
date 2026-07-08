import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { getTransport } from '@/lib/mailer';
import { putObject } from '@/lib/storage';
import { generateInvoicePdf, getCompanyInfo } from '@/lib/invoice-pdf';

export const maxDuration = 60;

/** Faturayı PDF olarak üretip müşteriye e-posta ile gönderir; sentAt damgalar. Yalnızca B/A. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    const inv = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { client: true, items: { orderBy: { order: 'asc' } } },
    });
    if (!inv || inv.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');

    const to = inv.client?.email;
    if (!to) {
      throw new ApiError(400, 'Müşteri e-posta adresi yok — faturayı göndermek için müşteriye e-posta tanımlayın.');
    }

    const company = await getCompanyInfo();
    const pdf = await generateInvoicePdf({
      invoiceNo: inv.invoiceNo,
      currency: inv.currency,
      status: inv.status,
      createdAt: inv.createdAt,
      dueDate: inv.dueDate,
      amount: inv.amount,
      subtotal: inv.subtotal,
      vatTotal: inv.vatTotal,
      discount: inv.discount,
      notes: inv.notes,
      client: inv.client,
      items: inv.items,
      company,
    });

    // PDF'yi (yapılandırılmışsa) object storage'a yükle; başarısızsa mevcut pdfUrl'i koru.
    let pdfUrl: string | null = inv.pdfUrl;
    try {
      const url = await putObject(`invoices/${inv.invoiceNo}.pdf`, pdf, 'application/pdf');
      if (url) pdfUrl = url;
    } catch (e) {
      console.error('[invoice/send] PDF depoya yüklenemedi:', e);
    }

    const { transport, from } = await getTransport();
    const greeting = inv.client?.contactName || inv.client?.companyName || 'Sayın Müşterimiz';
    const amountStr = inv.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const due = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('tr-TR') : null;

    await transport.sendMail({
      from,
      to,
      subject: `Fatura ${inv.invoiceNo} — ${company.name}`,
      text:
        `Sayın ${greeting},\n\n` +
        `${inv.invoiceNo} numaralı faturanız ektedir.\n` +
        `Tutar: ${amountStr} ${inv.currency}\n` +
        (due ? `Son ödeme tarihi: ${due}\n` : '') +
        `\nSaygılarımızla,\n${company.name}`,
      html:
        `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6">` +
        `<p>Sayın ${greeting},</p>` +
        `<p><strong>${inv.invoiceNo}</strong> numaralı faturanız ektedir.</p>` +
        `<ul>` +
        `<li>Tutar: <strong>${amountStr} ${inv.currency}</strong></li>` +
        (due ? `<li>Son ödeme tarihi: ${due}</li>` : '') +
        `</ul>` +
        `<p>Saygılarımızla,<br/>${company.name}</p>` +
        `</div>`,
      attachments: [{ filename: `${inv.invoiceNo}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });

    const updated = await prisma.invoice.update({
      where: { id: inv.id },
      data: { sentAt: new Date(), pdfUrl },
    });
    await audit(session, 'sent', 'invoice', inv.id, `Fatura e-posta ile gönderildi: ${inv.invoiceNo} → ${to}`);
    return NextResponse.json({ ok: true, sentAt: updated.sentAt });
  } catch (error) {
    return handleApiError(error, 'Fatura gönderilemedi');
  }
}
