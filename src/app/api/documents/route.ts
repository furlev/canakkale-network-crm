import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { documentCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.document.findMany({ orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.document.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Dokümanlar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, documentCreate);
    const created = await prisma.document.create({
      data: {
        name: body.name,
        type: body.type || 'other',
        size: body.size ?? 0,
        url: body.url || null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Doküman oluşturulamadı');
  }
}
