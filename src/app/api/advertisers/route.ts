import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { advertiserCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.advertiser.findMany({ orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.advertiser.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Reklam verenler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, advertiserCreate);
    const created = await prisma.advertiser.create({
      data: {
        company: body.company,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone || null,
        activeAds: body.activeAds ?? 0,
        totalSpent: body.totalSpent ?? 0,
        status: body.status || 'active',
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Reklam veren oluşturulamadı');
  }
}
