import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { leadCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.lead.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.lead.count({ where: { deletedAt: null } }) : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Lead listesi alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, leadCreate);
    const created = await prisma.lead.create({
      data: {
        name: body.name,
        company: body.company || null,
        value: body.value ?? 0,
        status: body.status || 'new',
        priority: body.priority || 'normal',
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Lead oluşturulamadı');
  }
}
