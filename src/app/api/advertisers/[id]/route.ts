import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const params = await context.params;
    
    const updatedAdvertiser = await prisma.advertiser.update({
      where: { id: params.id },
      data: {
        company: body.company,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        activeAds: body.activeAds,
        totalSpent: body.totalSpent,
        status: body.status,
      }
    });

    return NextResponse.json(updatedAdvertiser);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update advertiser' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.advertiser.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete advertiser' }, { status: 500 });
  }
}
