import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const params = await context.params;
    
    const updatedTip = await prisma.tip.update({
      where: { id: params.id },
      data: {
        status: body.status,
        priority: body.priority,
        reporterId: body.reporterId,
      }
    });

    return NextResponse.json(updatedTip);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update tip' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.tip.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete tip' }, { status: 500 });
  }
}
