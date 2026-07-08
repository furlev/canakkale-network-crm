import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel, ApiError } from '@/lib/api';
import { invoiceCreate } from '@/lib/schemas';
import { nextNumber } from '@/lib/notify';
import { audit } from '@/lib/audit';
import { computeInvoiceTotals } from '@/lib/invoice-pdf';

export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { client: true, items: { orderBy: { order: 'asc' } } },
        ...(pagination ?? {}),
      }),
      pagination ? prisma.invoice.count({ where: { deletedAt: null } }) : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Faturalar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, invoiceCreate);

    const items = body.items ?? [];
    const discount = body.discount ?? 0;

    // Toplamlar SUNUCUDA hesaplanır. Kalem yoksa (geriye dönük) amount elle gelmeli.
    let amount: number;
    let subtotal: number | null = null;
    let vatTotal: number | null = null;
    if (items.length > 0) {
      const t = computeInvoiceTotals(items, discount);
      amount = t.amount;
      subtotal = t.subtotal;
      vatTotal = t.vatTotal;
    } else {
      // Geriye dönük: kalem yoksa girilen tutar nihai genel toplamdır (indirim uygulanmaz).
      if (body.amount === undefined) {
        throw new ApiError(400, 'Tutar veya en az bir fatura kalemi gerekli');
      }
      amount = body.amount;
    }

    const [last, count] = await Promise.all([
      prisma.invoice.findFirst({ orderBy: { createdAt: 'desc' }, select: { invoiceNo: true } }),
      prisma.invoice.count(),
    ]);
    const invoiceNo = body.invoiceNo || nextNumber(last?.invoiceNo, 'INV', 4, count);

    const data: Prisma.InvoiceUncheckedCreateInput = {
      invoiceNo,
      amount,
      currency: body.currency || 'TRY',
      subtotal,
      vatTotal,
      discount: discount > 0 ? discount : null,
      status: body.status || 'unpaid',
      clientId: body.clientId || null,
      advertiserId: body.advertiserId || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      notes: body.notes ?? null,
    };
    if (items.length > 0) {
      data.items = {
        create: items.map((it, i) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          vatRate: it.vatRate,
          order: i,
        })),
      };
    }

    const created = await prisma.invoice.create({
      data,
      include: { client: true, items: { orderBy: { order: 'asc' } } },
    });
    await audit(session, 'created', 'invoice', created.id, `Fatura oluşturuldu: ${created.invoiceNo} — ${amount.toLocaleString('tr-TR')}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Fatura oluşturulamadı');
  }
}
