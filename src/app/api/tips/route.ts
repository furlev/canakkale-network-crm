import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { tipCreate } from '@/lib/schemas';
import { notify, nextNumber } from '@/lib/notify';

const safeReporter = { select: { id: true, name: true, email: true, role: true, department: true, status: true, avatar: true } };

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.tip.findMany({
        orderBy: { createdAt: 'desc' },
        include: { reporter: safeReporter },
        ...(pagination ?? {}),
      }),
      pagination ? prisma.tip.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'İhbarlar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, tipCreate);

    const [last, count] = await Promise.all([
      prisma.tip.findFirst({ orderBy: { createdAt: 'desc' }, select: { tipNumber: true } }),
      prisma.tip.count(),
    ]);
    const tipNumber = nextNumber(last?.tipNumber, 'TIP', 3, count);

    const created = await prisma.tip.create({
      data: {
        tipNumber,
        subject: body.subject,
        content: body.content,
        source: body.source || 'Anonim',
        sourceType: body.sourceType || 'email',
        priority: body.priority || 'normal',
        status: body.status || 'new',
      },
    });

    await notify('tip', `Yeni ihbar: ${created.subject}`, '/tips');
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'İhbar oluşturulamadı');
  }
}
