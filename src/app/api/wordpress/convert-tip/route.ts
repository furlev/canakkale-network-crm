import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getWpConfig, wpFetch } from '@/lib/wordpress';
import { parseBody, handleApiError, ApiError, requireLevel } from '@/lib/api';

const convertSchema = z.object({
  tipId: z.string().min(1),
});

type ConvertResponse = {
  status: string;
  post_id: number;
  edit_url: string;
};

/** Send a tip to WordPress as a draft post and mark it converted. */
export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, convertSchema);

    const tip = await prisma.tip.findUnique({ where: { id: body.tipId } });
    if (!tip) throw new ApiError(404, 'İhbar bulunamadı');

    const config = await getWpConfig();
    const result = await wpFetch<ConvertResponse>(config, '/tips/convert', {
      method: 'POST',
      body: JSON.stringify({
        title: tip.subject,
        content: `${tip.content}\n\n— Kaynak: ${tip.source} (${tip.tipNumber})`,
        tip_id: tip.tipNumber,
      }),
    });

    await prisma.tip.update({
      where: { id: tip.id },
      data: { status: 'converted' },
    });

    return NextResponse.json({
      ok: true,
      postId: result.post_id,
      editUrl: result.edit_url,
      message: `WordPress'te taslak yazı oluşturuldu (#${result.post_id})`,
    });
  } catch (error) {
    return handleApiError(error, 'İhbar habere dönüştürülemedi');
  }
}
