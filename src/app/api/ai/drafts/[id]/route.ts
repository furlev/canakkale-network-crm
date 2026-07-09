import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { aiDraftUpdate } from '@/lib/schemas';
import type { Prisma } from '@prisma/client';

/** Taslak alanlarını / durumunu günceller. Onay/ret olurken reviewer bilgisi işlenir. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const body = await parseBody(request, aiDraftUpdate);
    const { id } = await context.params;

    const data: Prisma.AiDraftUpdateInput = {
      title: body.title,
      body: body.body,
      category: body.category,
      tags: body.tags,
      seoTitle: body.seoTitle,
      metaDescription: body.metaDescription,
      socialPost: body.socialPost,
      imageUrl: body.imageUrl,
      district: body.district,
      status: body.status,
    };

    // Onaylanırken/reddedilirken değerlendiren kullanıcıyı damgala
    if (body.status === 'approved' || body.status === 'rejected') {
      data.reviewerId = session?.sub ?? null;
      data.reviewerName = session?.name ?? null;
    }

    const updated = await prisma.aiDraft.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Taslak güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const { id } = await context.params;
    await prisma.aiDraft.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Taslak silinemedi');
  }
}
