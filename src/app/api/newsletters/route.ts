import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';

const newsletterCreate = z.object({
  subject: z.string().min(1),
  intro: z.string().optional().nullable(),
  content: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.newsletter.findMany({ orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.newsletter.count() : Promise.resolve(undefined),
    ]);

    // Açılma/tık istatistikleri: yalnız listelenen bültenler için gruplu sayım (ucuz).
    const ids = items.map(i => i.id);
    const [opened, clicked] = ids.length
      ? await Promise.all([
          prisma.newsletterRecipient.groupBy({
            by: ['newsletterId'],
            where: { newsletterId: { in: ids }, openedAt: { not: null } },
            _count: { _all: true },
          }),
          prisma.newsletterRecipient.groupBy({
            by: ['newsletterId'],
            where: { newsletterId: { in: ids }, clickedAt: { not: null } },
            _count: { _all: true },
          }),
        ])
      : [[], []];
    const openMap = new Map(opened.map(r => [r.newsletterId, r._count._all]));
    const clickMap = new Map(clicked.map(r => [r.newsletterId, r._count._all]));

    const withStats = items.map(i => ({
      ...i,
      stats: { total: i.recipients, opened: openMap.get(i.id) ?? 0, clicked: clickMap.get(i.id) ?? 0 },
    }));
    return listResponse(withStats, total);
  } catch (error) {
    return handleApiError(error, 'Bültenler alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('B');
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
