import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';

const newsletterUpdate = z.object({
  subject: z.string().min(1).optional(),
  intro: z.string().optional().nullable(),
  content: z.string().min(1).optional(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await parseBody(request, newsletterUpdate);
    const params = await context.params;
    const updated = await prisma.newsletter.update({
      where: { id: params.id },
      data: { subject: body.subject, intro: body.intro, content: body.content },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Bülten güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await prisma.newsletter.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Bülten silinemedi');
  }
}
