import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { ticketCreate } from '@/lib/schemas';
import { nextNumber } from '@/lib/notify';

const safeAssignee = { select: { id: true, name: true, email: true, role: true, department: true, status: true, avatar: true } };

export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        orderBy: { createdAt: 'desc' },
        include: { client: true, assignee: safeAssignee },
        ...(pagination ?? {}),
      }),
      pagination ? prisma.ticket.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Destek talepleri alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, ticketCreate);

    const [last, count] = await Promise.all([
      prisma.ticket.findFirst({ orderBy: { createdAt: 'desc' }, select: { ticketNo: true } }),
      prisma.ticket.count(),
    ]);
    const ticketNo = body.ticketNo || nextNumber(last?.ticketNo, 'TKT', 4, count);

    const created = await prisma.ticket.create({
      data: {
        ticketNo,
        subject: body.subject,
        description: body.description || null,
        status: body.status || 'open',
        priority: body.priority || 'normal',
        clientId: body.clientId || null,
        assigneeId: body.assigneeId || null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Destek talebi oluşturulamadı');
  }
}
