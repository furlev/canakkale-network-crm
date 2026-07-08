import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { isAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';

/** Kayıtlı rapor şablonu güncelle/sil (B+). Yalnız sahibi veya A değiştirebilir. */

const savedReportUpdate = z.object({
  name: z.string().min(1).max(120).optional(),
  type: z.string().min(1).max(40).optional(),
  config: z.unknown().optional(),
});

function parseConfig(json: string | null | undefined): unknown {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, savedReportUpdate);
    const params = await context.params;
    const existing = await prisma.savedReport.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, 'Kayıt bulunamadı');
    if (existing.ownerId && existing.ownerId !== session.sub && !isAdmin(session)) {
      throw new ApiError(403, 'Bu rapor şablonunu değiştirme yetkiniz yok');
    }

    const data: Prisma.SavedReportUncheckedUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) data.type = body.type;
    if (body.config !== undefined) data.config = JSON.stringify(body.config ?? {});

    const updated = await prisma.savedReport.update({ where: { id: params.id }, data });
    await audit(session, 'updated', 'savedReport', updated.id, `Rapor şablonu güncellendi: ${updated.name}`);
    return NextResponse.json({ ...updated, config: parseConfig(updated.config) });
  } catch (error) {
    return handleApiError(error, 'Rapor şablonu güncellenemedi');
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    const existing = await prisma.savedReport.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, 'Kayıt bulunamadı');
    if (existing.ownerId && existing.ownerId !== session.sub && !isAdmin(session)) {
      throw new ApiError(403, 'Bu rapor şablonunu silme yetkiniz yok');
    }
    await prisma.savedReport.delete({ where: { id: params.id } });
    await audit(session, 'deleted', 'savedReport', existing.id, `Rapor şablonu silindi: ${existing.name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Rapor şablonu silinemedi');
  }
}
