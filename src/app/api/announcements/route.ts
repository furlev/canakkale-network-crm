import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { announcementCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    await requireLevel(); // C: duyuruları her kullanıcı görebilir
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.announcement.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Duyurular alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, announcementCreate);
    const created = await prisma.announcement.create({
      data: {
        title: body.title,
        content: body.content,
        target: body.target || 'Herkes',
        priority: body.priority || 'normal',
        author: body.author || 'Admin',
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Duyuru oluşturulamadı');
  }
}
