import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { subscriberCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.subscriber.findMany({ orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.subscriber.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Aboneler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, subscriberCreate);
    const created = await prisma.subscriber.create({
      data: {
        email: body.email,
        source: body.source || 'website',
        status: body.status || 'active',
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Abone oluşturulamadı');
  }
}
