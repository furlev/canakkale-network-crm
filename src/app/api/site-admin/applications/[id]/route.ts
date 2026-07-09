import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';

const applicationUpdate = z.object({
  // action:'convert' → başvuruyu CRM Lead'ine aktarır (aşağıda ayrı ele alınır).
  action: z.enum(['convert']).optional(),
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

    // ─── Başvuru → Lead aktarımı (#33) ───
    if (body.action === 'convert') {
      if (existing.convertedLeadId) {
        // Idempotency: zaten aktarılmış — mevcut Lead hâlâ duruyorsa çakışma bildir.
        const stillThere = await prisma.lead.findUnique({ where: { id: existing.convertedLeadId }, select: { id: true } });
        if (stillThere) throw new ApiError(409, 'Bu başvuru zaten Lead\'e aktarılmış');
      }
      // Başvuru form yanıtlarını (data JSON) + değerlendirme notunu okunur nota çevir.
      let formSummary = '';
      try {
        const answers = JSON.parse(existing.data) as Record<string, unknown>;
        formSummary = Object.entries(answers)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join('\n');
      } catch { /* data JSON değilse atla */ }
      const noteParts = [existing.note || null, formSummary || null].filter(Boolean).join('\n\n');
      const lead = await prisma.lead.create({
        data: {
          name: existing.name,
          email: existing.email || null,
          phone: existing.phone || null,
          notes: (noteParts || null)?.slice(0, 4000) ?? null,
          source: 'Katılım Başvurusu',
          status: 'new',
        },
      });
      const updatedApp = await prisma.joinApplication.update({
        where: { id },
        data: { convertedLeadId: lead.id },
      });
      await audit(session, 'created', 'lead', lead.id, `Başvurudan Lead oluşturuldu: ${existing.name}`);
      await notify('lead', `Yeni lead (başvuru): ${existing.name}`, '/leads');
      return NextResponse.json({ ...updatedApp, lead: { id: lead.id } });
    }

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
