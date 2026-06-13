import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';

const newsletterCreate = z.object({
  subject: z.string().min(1),
  intro: z.string().optional().nullable(),
  content: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.newsletter.findMany({ orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.newsletter.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Bültenler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, newsletterCreate);
    const created = await prisma.newsletter.create({
      data: {
        subject: body.subject,
        intro: body.intro || null,
        content: body.content,
        status: 'draft',
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Bülten oluşturulamadı');
  }
}
