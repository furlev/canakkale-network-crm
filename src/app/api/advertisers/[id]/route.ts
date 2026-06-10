import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { advertiserUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseBody(request, advertiserUpdate);
    const params = await context.params;
    const updated = await prisma.advertiser.update({
      where: { id: params.id },
      data: {
        company: body.company,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        activeAds: body.activeAds,
        totalSpent: body.totalSpent,
        status: body.status,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Reklam veren güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.advertiser.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Reklam veren silinemedi');
  }
}
