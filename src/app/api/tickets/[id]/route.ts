import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { ticketUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseBody(request, ticketUpdate);
    const params = await context.params;
    const updated = await prisma.ticket.update({
      where: { id: params.id },
      data: {
        subject: body.subject,
        description: body.description,
        status: body.status,
        priority: body.priority,
        clientId: body.clientId !== undefined ? (body.clientId || null) : undefined,
        assigneeId: body.assigneeId !== undefined ? (body.assigneeId || null) : undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Destek talebi güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.ticket.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Destek talebi silinemedi');
  }
}
