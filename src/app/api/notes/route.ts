import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { noteCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.note.findMany({ orderBy: { updatedAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.note.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Notlar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, noteCreate);
    const created = await prisma.note.create({
      data: {
        title: body.title,
        content: body.content || '',
        category: body.category || 'Genel',
        color: body.color || '#6c5ce7',
        shared: body.shared ?? false,
        favorite: body.favorite ?? false,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Not oluşturulamadı');
  }
}
