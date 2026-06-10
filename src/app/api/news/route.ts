import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { newsCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.news.findMany({ orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.news.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Haberler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, newsCreate);
    const created = await prisma.news.create({
      data: {
        title: body.title,
        category: body.category || 'Genel',
        author: body.author || 'Editör',
        status: body.status || 'draft',
        publishDate: body.status === 'published' ? new Date() : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Haber oluşturulamadı');
  }
}
