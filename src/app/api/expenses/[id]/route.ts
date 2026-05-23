import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const params = await context.params;
    
    const updatedExpense = await prisma.expense.update({
      where: { id: params.id },
      data: {
        category: body.category,
        amount: body.amount,
        description: body.description,
        date: body.date ? new Date(body.date) : undefined,
      }
    });

    return NextResponse.json(updatedExpense);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.expense.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
