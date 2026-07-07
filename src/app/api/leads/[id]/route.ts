import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { leadUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, leadUpdate);
    const params = await context.params;
    const updated = await prisma.lead.update({
      where: { id: params.id },
      data: {
        name: body.name,
        company: body.company,
        value: body.value,
        status: body.status,
        priority: body.priority,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Lead güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const params = await context.params;
    await prisma.lead.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Lead silinemedi');
  }
}
