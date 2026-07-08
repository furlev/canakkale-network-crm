import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel, ApiError } from '@/lib/api';
import { nextNumber } from '@/lib/notify';
import { audit } from '@/lib/audit';

/**
 * POST /api/contracts/[id]/invoice — Sözleşme → Fatura üretir (B+).
 * Sözleşme tutarını tek kalemli bir faturaya taşır ve convertedToId ile bağlar.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;

    const contract = await prisma.contract.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!contract) throw new ApiError(404, 'Sözleşme bulunamadı');
    if (contract.convertedToId) {
      throw new ApiError(409, 'Bu sözleşmeden zaten fatura üretilmiş');
    }

    const [last, count] = await Promise.all([
      prisma.invoice.findFirst({ orderBy: { createdAt: 'desc' }, select: { invoiceNo: true } }),
      prisma.invoice.count(),
    ]);
    const invoiceNo = nextNumber(last?.invoiceNo, 'INV', 4, count);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        amount: contract.value || 0,
        currency: 'TRY',
        status: 'unpaid',
        clientId: contract.clientId || null,
        notes: `Sözleşme kaynaklı fatura: ${contract.title}`,
      },
      include: { client: true },
    });

    await prisma.contract.update({ where: { id: contract.id }, data: { convertedToId: invoice.id } });

    await audit(
      session,
      'converted',
      'contract',
      contract.id,
      `Sözleşme "${contract.title}" → Fatura ${invoice.invoiceNo} üretildi`
    );

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Sözleşmeden fatura üretilemedi');
  }
}
