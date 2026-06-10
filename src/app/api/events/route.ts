import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { eventCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.event.findMany({ orderBy: { date: 'asc' }, ...(pagination ?? {}) }),
      pagination ? prisma.event.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Etkinlikler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, eventCreate);
    const created = await prisma.event.create({
      data: {
        title: body.title,
        date: new Date(body.date),
        type: body.type || 'event',
        description: body.description || null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Etkinlik oluşturulamadı');
  }
}
