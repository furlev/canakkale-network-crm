import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { invoiceCreate } from '@/lib/schemas';
import { nextNumber } from '@/lib/notify';

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({ orderBy: { createdAt: 'desc' }, include: { client: true }, ...(pagination ?? {}) }),
      pagination ? prisma.invoice.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Faturalar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, invoiceCreate);

    const [last, count] = await Promise.all([
      prisma.invoice.findFirst({ orderBy: { createdAt: 'desc' }, select: { invoiceNo: true } }),
      prisma.invoice.count(),
    ]);
    const invoiceNo = body.invoiceNo || nextNumber(last?.invoiceNo, 'INV', 4, count);

    const created = await prisma.invoice.create({
      data: {
        invoiceNo,
        amount: body.amount,
        status: body.status || 'unpaid',
        clientId: body.clientId || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Fatura oluşturulamadı');
  }
}
