import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { clientUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseBody(request, clientUpdate);
    const params = await context.params;
    const updated = await prisma.client.update({
      where: { id: params.id },
      data: {
        companyName: body.companyName,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        status: body.status,
        satisfaction: body.satisfaction,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Müşteri güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.client.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Müşteri silinemedi');
  }
}
