import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { advertiserUpdate } from '@/lib/schemas';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, advertiserUpdate);
    const params = await context.params;
    // Public rapor token'ı yoksa bu düzenlemede üret (eski kayıtlar için backfill)
    const existing = await prisma.advertiser.findUnique({
      where: { id: params.id },
      select: { reportToken: true },
    });
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
        ...(existing && !existing.reportToken ? { reportToken: randomBytes(24).toString('base64url') } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Reklam veren güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const params = await context.params;
    await prisma.advertiser.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Reklam veren silinemedi');
  }
}
