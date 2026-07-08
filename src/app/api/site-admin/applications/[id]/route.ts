import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

const applicationUpdate = z.object({
  status: z.enum(['new', 'reviewed', 'accepted', 'rejected']).optional(),
  note: z.string().optional().nullable(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const body = await parseBody(request, applicationUpdate);

    const existing = await prisma.joinApplication.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Başvuru bulunamadı');

    const updated = await prisma.joinApplication.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.note !== undefined ? { note: body.note || null } : {}),
      },
    });

    await audit(
      session, 'updated', 'joinApplication', id,
      `Başvuru güncellendi: ${existing.name}${body.status ? ` → ${body.status}` : ''}`
    );
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Başvuru güncellenemedi');
  }
}

/** DELETE — kalıcı silme (KVKK: başvuru sahibinin verisi tamamen kaldırılabilmeli). */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;
    const existing = await prisma.joinApplication.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Başvuru bulunamadı');

    await prisma.joinApplication.delete({ where: { id } });
    // KVKK: kişisel veriyi denetim detayına da yazma — yalnızca id izi kalır
    await audit(session, 'deleted', 'joinApplication', id, 'Başvuru kalıcı olarak silindi (KVKK)');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'Başvuru silinemedi');
  }
}
