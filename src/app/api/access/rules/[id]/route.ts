import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError, requireLevel } from '@/lib/api';
import { isAdmin } from '@/lib/permissions';
import { clearAccessCache } from '@/lib/access';
import { audit } from '@/lib/audit';

/** DELETE: kural sil. A her kuralı; B yalnız kendi alt ekibini hedefleyen kuralları silebilir. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { id } = await context.params;

    const rule = await prisma.accessRule.findUnique({ where: { id } });
    if (!rule) throw new ApiError(404, 'Kural bulunamadı');

    if (!isAdmin(session)) {
      if (!rule.targetUserId) throw new ApiError(403, 'Rol geneli kuralları yalnızca Baş Yönetici silebilir');
      const target = await prisma.user.findUnique({ where: { id: rule.targetUserId }, select: { managerId: true } });
      if (!target || target.managerId !== session.sub) {
        throw new ApiError(403, 'Yalnızca kendi alt ekibinize ait kuralları silebilirsiniz');
      }
    }

    await prisma.accessRule.delete({ where: { id } });
    clearAccessCache();
    await audit(session, 'deleted', 'access', id, `Erişim kuralı silindi: ${rule.path}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Erişim kuralı silinemedi');
  }
}
