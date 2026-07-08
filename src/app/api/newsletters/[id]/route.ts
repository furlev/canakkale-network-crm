import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError, requireLevel } from '@/lib/api';

const newsletterUpdate = z.object({
  subject: z.string().min(1).optional(),
  intro: z.string().optional().nullable(),
  content: z.string().min(1).optional(),
});

/** Tek bülten + açılma/tık istatistikleri. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const params = await context.params;
    const newsletter = await prisma.newsletter.findUnique({ where: { id: params.id } });
    if (!newsletter) throw new ApiError(404, 'Bülten bulunamadı');

    const [total, opened, clicked] = await Promise.all([
      prisma.newsletterRecipient.count({ where: { newsletterId: params.id } }),
      prisma.newsletterRecipient.count({ where: { newsletterId: params.id, openedAt: { not: null } } }),
      prisma.newsletterRecipient.count({ where: { newsletterId: params.id, clickedAt: { not: null } } }),
    ]);

    return NextResponse.json({ ...newsletter, stats: { total, opened, clicked } });
  } catch (error) {
    return handleApiError(error, 'Bülten alınamadı');
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, newsletterUpdate);
    const params = await context.params;
    // Gönderilmiş bülten dondurulur (istatistik/iz bütünlüğü).
    const existing = await prisma.newsletter.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!existing) throw new ApiError(404, 'Bülten bulunamadı');
    if (existing.status === 'sent') throw new ApiError(400, 'Gönderilmiş bülten düzenlenemez');

    const updated = await prisma.newsletter.update({
      where: { id: params.id },
      data: { subject: body.subject, intro: body.intro, content: body.content },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Bülten güncellenemedi');
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const params = await context.params;
    // NewsletterRecipient'in newsletterId'si FK değil → yetim satırları elle temizle.
    await prisma.newsletterRecipient.deleteMany({ where: { newsletterId: params.id } });
    await prisma.newsletter.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Bülten silinemedi');
  }
}
