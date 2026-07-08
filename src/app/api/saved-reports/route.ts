import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Kaydedilen rapor şablonları (B+). config serbest JSON (tarih aralığı + metrikler);
 * daima string olarak saklanır, çağıran için parse edilerek döndürülür.
 * ownerId oturum kullanıcısıdır; sahibi olan + ortak (ownerId null) şablonlar listelenir.
 */

const savedReportCreate = z.object({
  name: z.string().min(1).max(120),
  type: z.string().min(1).max(40),
  config: z.unknown().optional(),
});

function parseConfig(json: string | null | undefined): unknown {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

export async function GET() {
  try {
    const session = await requireLevel('B');
    const items = await prisma.savedReport.findMany({
      where: { OR: [{ ownerId: session.sub }, { ownerId: null }] },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(items.map((r) => ({ ...r, config: parseConfig(r.config) })));
  } catch (error) {
    return handleApiError(error, 'Kayıtlı raporlar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, savedReportCreate);
    const created = await prisma.savedReport.create({
      data: {
        name: body.name,
        type: body.type,
        config: JSON.stringify(body.config ?? {}),
        ownerId: session.sub,
      },
    });
    await audit(session, 'created', 'savedReport', created.id, `Rapor şablonu: ${created.name}`);
    return NextResponse.json({ ...created, config: parseConfig(created.config) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Rapor şablonu kaydedilemedi');
  }
}
