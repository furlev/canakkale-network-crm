import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';

const campaignUpdate = z.object({
  name: z.string().min(1).optional(),
  placement: z.enum(['banner', 'native', 'video', 'sidebar']).optional(),
  status: z.enum(['active', 'paused', 'ended']).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  budget: z.coerce.number().min(0).optional(),
  advertiserId: z.string().nullable().optional(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, campaignUpdate);
    const params = await context.params;
    const updated = await prisma.adCampaign.update({
      where: { id: params.id },
      data: {
        name: body.name,
        placement: body.placement,
        status: body.status,
        budget: body.budget,
        startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
        endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
        advertiserId: body.advertiserId !== undefined ? (body.advertiserId || null) : undefined,
      },
      include: { advertiser: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Kampanya güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const params = await context.params;
    await prisma.adCampaign.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Kampanya silinemedi');
  }
}
