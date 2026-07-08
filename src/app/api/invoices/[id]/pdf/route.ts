import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel, ApiError } from '@/lib/api';
import { generateInvoicePdf, getCompanyInfo } from '@/lib/invoice-pdf';

/** Faturayı kurumsal PDF olarak döndürür (satır içi görüntüleme). Yalnızca B/A. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const params = await context.params;
    const inv = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { client: true, items: { orderBy: { order: 'asc' } } },
    });
    if (!inv || inv.deletedAt) throw new ApiError(404, 'Kayıt bulunamadı');

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

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${inv.invoiceNo}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error, 'Fatura PDF üretilemedi');
  }
}
