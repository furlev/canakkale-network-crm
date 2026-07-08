import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * POST /api/estimates/[id]/convert — Teklif → Sözleşme dönüştürür (B+).
 * Veriyi taşır (tutar → value, müşteri), sourceId/convertedToId ile iki kaydı bağlar
 * ve sözleşmeye halka açık e-imza linki için publicToken üretir.
 */

/** URL-güvenli rastgele token (base64url). */
function publicToken(): string {
  return randomBytes(18).toString('base64url');
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;

    const estimate = await prisma.estimate.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!estimate) throw new ApiError(404, 'Teklif bulunamadı');
    if (estimate.convertedToId) {
      throw new ApiError(409, 'Bu teklif zaten bir sözleşmeye dönüştürülmüş');
    }

    const contract = await prisma.contract.create({
      data: {
        title: `${estimate.estimateNo} — Sözleşme`,
        value: estimate.amount,
        status: 'draft',
        clientId: estimate.clientId || null,
        sourceId: estimate.id,
        publicToken: publicToken(),
      },
      include: { client: true },
    });

    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { convertedToId: contract.id, status: 'accepted' },
    });

    await audit(
      session,
      'converted',
      'estimate',
      estimate.id,
      `Teklif ${estimate.estimateNo} → Sözleşme ${contract.id} dönüştürüldü`
    );

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Teklif dönüştürülemedi');
  }
}
