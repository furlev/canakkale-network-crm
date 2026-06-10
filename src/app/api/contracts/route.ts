import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { contractCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.contract.findMany({ orderBy: { createdAt: 'desc' }, include: { client: true }, ...(pagination ?? {}) }),
      pagination ? prisma.contract.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Sözleşmeler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, contractCreate);
    const created = await prisma.contract.create({
      data: {
        title: body.title,
        value: body.value ?? 0,
        status: body.status || 'draft',
        progress: body.progress ?? 0,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        clientId: body.clientId || null,
      },
      include: { client: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Sözleşme oluşturulamadı');
  }
}
