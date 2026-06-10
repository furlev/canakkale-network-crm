import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const params = await context.params;

    const updatedProposal = await prisma.proposal.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description,
        value: body.value,
        status: body.status,
        clientId: body.clientId !== undefined ? (body.clientId || null) : undefined,
      },
      include: { client: true }
    });

    return NextResponse.json(updatedProposal);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.proposal.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete proposal' }, { status: 500 });
  }
}
