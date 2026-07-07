import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { clientCreate } from '@/lib/schemas';
import { notify } from '@/lib/notify';

export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.client.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.client.count({ where: { deletedAt: null } }) : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Müşteriler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, clientCreate);
    const created = await prisma.client.create({
      data: {
        companyName: body.companyName,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone || null,
        status: body.status || 'active',
        satisfaction: body.satisfaction ?? 100,
      },
    });

    await notify('client', `Yeni müşteri eklendi: ${created.companyName}`, '/clients');
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Müşteri oluşturulamadı');
  }
}
