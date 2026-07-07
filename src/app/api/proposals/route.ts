import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { proposalCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.proposal.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, include: { client: true }, ...(pagination ?? {}) }),
      pagination ? prisma.proposal.count({ where: { deletedAt: null } }) : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Teklifnameler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, proposalCreate);
    const created = await prisma.proposal.create({
      data: {
        title: body.title,
        description: body.description || null,
        value: body.value ?? 0,
        status: body.status || 'draft',
        clientId: body.clientId || null,
      },
      include: { client: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Teklifname oluşturulamadı');
  }
}
