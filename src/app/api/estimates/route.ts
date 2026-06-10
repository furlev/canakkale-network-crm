import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { estimateCreate } from '@/lib/schemas';
import { nextNumber } from '@/lib/notify';

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.estimate.findMany({ orderBy: { createdAt: 'desc' }, include: { client: true }, ...(pagination ?? {}) }),
      pagination ? prisma.estimate.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Teklifler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, estimateCreate);

    const [last, count] = await Promise.all([
      prisma.estimate.findFirst({ orderBy: { createdAt: 'desc' }, select: { estimateNo: true } }),
      prisma.estimate.count(),
    ]);
    const estimateNo = body.estimateNo || nextNumber(last?.estimateNo, 'EST', 4, count);

    const created = await prisma.estimate.create({
      data: {
        estimateNo,
        amount: body.amount,
        status: body.status || 'draft',
        clientId: body.clientId || null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Teklif oluşturulamadı');
  }
}
