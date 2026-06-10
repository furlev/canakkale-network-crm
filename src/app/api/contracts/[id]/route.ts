import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const params = await context.params;

    const updatedContract = await prisma.contract.update({
      where: { id: params.id },
      data: {
        title: body.title,
        value: body.value,
        status: body.status,
        progress: body.progress,
        startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
        endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
        clientId: body.clientId !== undefined ? (body.clientId || null) : undefined,
      },
      include: { client: true }
    });

    return NextResponse.json(updatedContract);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update contract' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.contract.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete contract' }, { status: 500 });
  }
}
