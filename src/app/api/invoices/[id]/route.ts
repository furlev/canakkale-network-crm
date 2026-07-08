import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { invoiceUpdate } from '@/lib/schemas';
import { notify } from '@/lib/notify';
import { computeInvoiceTotals } from '@/lib/invoice-pdf';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, invoiceUpdate);
    const params = await context.params;
    const before = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { status: true, deletedAt: true, discount: true },
    });
    if (!before || before.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');

    const data: Prisma.InvoiceUncheckedUpdateInput = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.notes !== undefined) data.notes = body.notes ?? null;
    if (body.clientId !== undefined) data.clientId = body.clientId || null;
    if (body.advertiserId !== undefined) data.advertiserId = body.advertiserId || null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    if (body.items !== undefined) {
      if (body.items.length > 0) {
        // Kalemler gönderildi → toplamları yeniden hesapla, kalemleri değiştir.
        const disc = body.discount ?? before.discount ?? 0;
        const t = computeInvoiceTotals(body.items, disc);
        data.subtotal = t.subtotal;
        data.vatTotal = t.vatTotal;
        data.amount = t.amount;
        data.discount = t.discount > 0 ? t.discount : null;
        data.items = {
          deleteMany: {},
          create: body.items.map((it, i) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            vatRate: it.vatRate,
            order: i,
          })),
        };
      } else {
        // Kalemler temizlendi → basit (elle tutarlı) faturaya dön.
        data.items = { deleteMany: {} };
        data.subtotal = null;
        data.vatTotal = null;
        if (body.amount !== undefined) data.amount = body.amount;
        if (body.discount !== undefined) data.discount = body.discount > 0 ? body.discount : null;
      }
    } else {
      // Kalem alanı yok (geriye dönük): amount/discount elle güncellenir.
      if (body.amount !== undefined) data.amount = body.amount;
      if (body.discount !== undefined) data.discount = body.discount > 0 ? body.discount : null;
    }

    const updated = await prisma.invoice.update({
      where: { id: params.id },
      data,
      include: { client: true, items: { orderBy: { order: 'asc' } } },
    });

    if (before.status !== 'paid' && updated.status === 'paid') {
      await notify('invoice_paid', `Fatura ${updated.invoiceNo} ödendi — ₺${updated.amount.toLocaleString('tr-TR')}`, '/invoices');
    }
    await audit(session, 'updated', 'invoice', updated.id, `Fatura güncellendi: ${updated.invoiceNo}`);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Fatura güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    // Yumuşak silme: kayıt çöp kutusuna taşınır, /trash sayfasından geri alınabilir
    const deleted = await prisma.invoice.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await audit(session, 'deleted', 'invoice', deleted.id, `Fatura çöp kutusuna taşındı: ${deleted.invoiceNo}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Fatura silinemedi');
  }
}
