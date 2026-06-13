import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { draftArticleFromTip, AiNotConfiguredError } from '@/lib/ai';

const schema = z.object({ tipId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, schema);
    const tip = await prisma.tip.findUnique({ where: { id: body.tipId } });
    if (!tip) throw new ApiError(404, 'İhbar bulunamadı');

    const draft = await draftArticleFromTip(tip.subject, tip.content, tip.source);
    return NextResponse.json(draft);
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'Haber taslağı oluşturulamadı');
  }
}
