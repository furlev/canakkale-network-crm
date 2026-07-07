import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { expenseCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.expense.findMany({ where: { deletedAt: null }, orderBy: { date: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.expense.count({ where: { deletedAt: null } }) : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Giderler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, expenseCreate);
    const created = await prisma.expense.create({
      data: {
        category: body.category,
        amount: body.amount,
        description: body.description || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Gider oluşturulamadı');
  }
}
