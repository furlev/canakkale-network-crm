import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const params = await context.params;
    
    const updatedEstimate = await prisma.estimate.update({
      where: { id: params.id },
      data: {
        status: body.status,
      }
    });

    return NextResponse.json(updatedEstimate);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update estimate' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.estimate.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete estimate' }, { status: 500 });
  }
}
