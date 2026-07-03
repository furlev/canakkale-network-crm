import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { budgetCreate } from '@/lib/schemas';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { notify } from '@/lib/notify';

export async function GET() {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için yetki gerekli');
    const budgets = await prisma.budget.findMany({
      orderBy: { createdAt: 'desc' },
      include: { requests: { include: { user: { select: { id: true, name: true } } } } },
    });
    return NextResponse.json(budgets);
  } catch (error) {
    return handleApiError(error, 'Bütçeler alınamadı');
  }
}

/** Ortak harcama bütçesi: seçili kullanıcılara ödeme talebi dağıtır. */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için yetki gerekli');
    const body = await parseBody(request, budgetCreate);
    const total = body.distributions.reduce((s, d) => s + d.amount, 0);
    const due = body.dueDate ? new Date(body.dueDate) : null;

    const budget = await prisma.budget.create({
      data: {
        title: body.title,
        description: body.description || null,
        totalAmount: total,
        createdBy: session?.name || null,
        requests: {
          create: body.distributions.map((d) => ({
            kind: 'collection',
            userId: d.userId,
            title: body.title,
            amount: d.amount,
            dueDate: due,
          })),
        },
      },
      include: { requests: { include: { user: { select: { id: true, name: true } } } } },
    });
    await notify('info', `Yeni bütçe: ${body.title} — ${body.distributions.length} kişiye ödeme talebi`, '/payments');
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Bütçe oluşturulamadı');
  }
}
