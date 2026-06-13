import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse } from '@/lib/api';

const campaignCreate = z.object({
  name: z.string().min(1),
  placement: z.enum(['banner', 'native', 'video', 'sidebar']).optional(),
  status: z.enum(['active', 'paused', 'ended']).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  budget: z.coerce.number().min(0).optional(),
  advertiserId: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.adCampaign.findMany({ orderBy: { createdAt: 'desc' }, include: { advertiser: true }, ...(pagination ?? {}) }),
      pagination ? prisma.adCampaign.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Kampanyalar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, campaignCreate);
    const created = await prisma.adCampaign.create({
      data: {
        name: body.name,
        placement: body.placement || 'banner',
        status: body.status || 'active',
        budget: body.budget ?? 0,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        advertiserId: body.advertiserId || null,
      },
      include: { advertiser: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Kampanya oluşturulamadı');
  }
}
