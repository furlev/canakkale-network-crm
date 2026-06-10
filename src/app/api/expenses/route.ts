import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';
import { expenseCreate } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.expense.findMany({ orderBy: { date: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.expense.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Giderler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
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
