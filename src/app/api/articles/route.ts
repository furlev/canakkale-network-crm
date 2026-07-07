import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { articleCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    await requireLevel(); // C: bilgi bankası tüm kullanıcılara açık
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.article.findMany({ orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.article.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Makaleler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, articleCreate);
    const created = await prisma.article.create({
      data: {
        title: body.title,
        content: body.content || null,
        category: body.category || 'Genel',
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Makale oluşturulamadı');
  }
}
