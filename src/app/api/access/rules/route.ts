import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError, requireLevel } from '@/lib/api';
import { isAdmin } from '@/lib/permissions';
import { MANAGED_PATHS, canAccessPathDynamic, clearAccessCache } from '@/lib/access';
import { audit } from '@/lib/audit';

const ruleCreate = z.object({
  path: z.string().min(1),
  targetRole: z.enum(['B', 'C']).optional().nullable(),
  targetUserId: z.string().optional().nullable(),
  allow: z.boolean(),
});

/** GET: erişim kuralları. A hepsini, B yalnız kendi alt ekibini hedefleyen kuralları görür. */
export async function GET() {
  try {
    const session = await requireLevel('B');

    if (isAdmin(session)) {
      const rules = await prisma.accessRule.findMany({ orderBy: { createdAt: 'desc' } });
      return NextResponse.json(rules);
    }

    const team = await prisma.user.findMany({ where: { managerId: session.sub }, select: { id: true } });
    const teamIds = team.map(u => u.id);
    const rules = await prisma.accessRule.findMany({
      where: { targetUserId: { in: teamIds } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(rules);
  } catch (error) {
    return handleApiError(error, 'Erişim kuralları alınamadı');
  }
}

/** POST: kural oluştur. A: rol geneli veya kişiye özel; B: yalnız kendi alt ekibindeki kişiler
 *  ve yalnız kendisinin de erişebildiği ekranlar için. */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, ruleCreate);

    if (!MANAGED_PATHS.some(p => p.path === body.path)) {
      throw new ApiError(400, 'Geçersiz ekran yolu');
    }
    if (!body.targetUserId && !body.targetRole) {
      throw new ApiError(400, 'Hedef (rol veya kullanıcı) belirtilmeli');
    }

    if (!isAdmin(session)) {
      // B kısıtları: rol geneli kural koyamaz; yalnız kendi alt ekibi; yalnız kendi erişebildiği ekran
      if (!body.targetUserId) throw new ApiError(403, 'Rol geneli kuralları yalnızca Baş Yönetici koyabilir');
      const target = await prisma.user.findUnique({ where: { id: body.targetUserId }, select: { managerId: true } });
      if (!target || target.managerId !== session.sub) {
        throw new ApiError(403, 'Yalnızca kendi alt ekibinizdeki kişiler için kural koyabilirsiniz');
      }
      if (!(await canAccessPathDynamic(session, body.path))) {
        throw new ApiError(403, 'Kendi erişemediğiniz bir ekranı başkasına açamazsınız');
      }
    }

    const created = await prisma.accessRule.create({
      data: {
        path: body.path,
        targetRole: body.targetUserId ? null : body.targetRole,
        targetUserId: body.targetUserId || null,
        allow: body.allow,
        grantedById: session.sub,
      },
    });
    clearAccessCache();
    await audit(session, created.allow ? 'granted' : 'revoked', 'access', created.id,
      `${body.path} → ${body.targetUserId ? 'kullanıcı ' + body.targetUserId : 'rol ' + body.targetRole} (${created.allow ? 'açıldı' : 'kapatıldı'})`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Erişim kuralı oluşturulamadı');
  }
}
