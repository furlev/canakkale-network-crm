import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import type { Prisma } from '@prisma/client';

/**
 * Onay kuyruğu için TOPLU işlem (çoklu seçim). Yalnız B/A.
 * Body: { ids: string[], action, scheduledAt?, editorNote? }
 *
 * action:
 *   approve  → status 'approved' (+ reviewer)
 *   reject   → status 'rejected' (+ reviewer)
 *   delete   → kayıtları siler
 *   schedule → scheduledAt zorunlu; status 'approved' + planlı yayın zamanı (+ reviewer)
 *   note     → yalnız editorNote / scheduledAt yazar (durum değişmez) — modaldaki redaksiyon notu
 *
 * NOT: Gerçek YAYIN buradan yapılmaz — .../publish rotası (WP/site) + planlı yayın
 * cron'u ayrı çalışır. Burada yalnız durum + editoryal alanlar güncellenir.
 */

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'En az bir taslak seçin').max(200, 'Tek seferde en fazla 200 taslak'),
  action: z.enum(['approve', 'reject', 'delete', 'schedule', 'note']),
  scheduledAt: z.string().nullable().optional(),
  editorNote: z.string().max(2000).nullable().optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const { ids, action, scheduledAt, editorNote } = await parseBody(request, bulkSchema);
    // approve/reject/schedule yayınlanmışı düşürmesin (publish rotasıyla tutarlı).
    const guardPublished = action === 'approve' || action === 'reject' || action === 'schedule';
    const where = guardPublished
      ? { id: { in: ids }, status: { not: 'published' } }
      : { id: { in: ids } };

    // scheduledAt'i çöz (schedule için zorunlu; note'ta opsiyonel/temizlenebilir)
    let scheduledDate: Date | null | undefined;
    if (scheduledAt !== undefined) {
      if (scheduledAt === null || scheduledAt === '') {
        scheduledDate = null;
      } else {
        const d = new Date(scheduledAt);
        if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Geçersiz planlama tarihi');
        scheduledDate = d;
      }
    }

    if (action === 'delete') {
      const res = await prisma.aiDraft.deleteMany({ where });
      await audit(session, 'deleted', 'aiDraft', null, `${res.count} AI taslağı toplu silindi`);
      return NextResponse.json({ ok: true, count: res.count });
    }

    const data: Prisma.AiDraftUpdateManyMutationInput = {};
    if (editorNote !== undefined) data.editorNote = editorNote?.trim() || null;

    if (action === 'approve' || action === 'reject') {
      data.status = action === 'approve' ? 'approved' : 'rejected';
      data.reviewerId = session?.sub ?? null;
      data.reviewerName = session?.name ?? null;
    } else if (action === 'schedule') {
      if (!scheduledDate) throw new ApiError(400, 'Planlama için geçerli bir tarih gerekli');
      data.status = 'approved';
      data.scheduledAt = scheduledDate;
      data.reviewerId = session?.sub ?? null;
      data.reviewerName = session?.name ?? null;
    } else if (action === 'note') {
      if (scheduledDate !== undefined) data.scheduledAt = scheduledDate;
      if (editorNote === undefined && scheduledDate === undefined) {
        throw new ApiError(400, 'Kaydedilecek bir değişiklik yok');
      }
    }

    const res = await prisma.aiDraft.updateMany({ where, data });

    const detailMap: Record<string, string> = {
      approve: `${res.count} AI taslağı toplu onaylandı`,
      reject: `${res.count} AI taslağı toplu reddedildi`,
      schedule: `${res.count} AI taslağı ${scheduledDate?.toLocaleString('tr-TR')} için planlandı`,
      note: `${res.count} AI taslağının editoryal notu/planı güncellendi`,
    };
    const auditAction = action === 'schedule' ? 'scheduled' : action === 'note' ? 'updated' : action === 'approve' ? 'approved' : 'rejected';
    await audit(session, auditAction, 'aiDraft', null, detailMap[action]);

    return NextResponse.json({ ok: true, count: res.count });
  } catch (error) {
    return handleApiError(error, 'Toplu işlem başarısız oldu');
  }
}
