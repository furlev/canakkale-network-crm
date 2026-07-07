import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { projectCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    await requireLevel('B'); // proje listesi müşteri verisi içerir; yalnız /projects (B+) kullanır
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.project.findMany({ orderBy: { createdAt: 'desc' }, include: { client: true }, ...(pagination ?? {}) }),
      pagination ? prisma.project.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Projeler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, projectCreate);
    const created = await prisma.project.create({
      data: {
        name: body.name,
        status: body.status || 'active',
        progress: body.progress ?? 0,
        clientId: body.clientId || null,
        deadline: body.deadline ? new Date(body.deadline) : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Proje oluşturulamadı');
  }
}
