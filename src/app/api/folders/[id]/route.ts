import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { levelOf, isAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import {
  folderUpdate,
  canSeeFolder,
  assertGrantableUsers,
  normalizeAccessEntries,
  LEVEL_ORDER,
} from '@/lib/depot';

async function loadFolder(id: string) {
  return prisma.folder.findFirst({
    where: { id, deletedAt: null },
    include: { access: { select: { userId: true, canWrite: true } } },
  });
}

/**
 * PUT /api/folders/[id] — yeniden adlandırma, minLevel, restricted, ACL değiştirme,
 * şifre ayarlama/sıfırlama (mevcut şifreyi değiştirme/kaldırma yalnız A — denetim kaydına düşer).
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    const body = await parseBody(request, folderUpdate);

    const folder = await loadFolder(params.id);
    if (!folder) throw new ApiError(404, 'Klasör bulunamadı');
    if (!isAdmin(session) && !canSeeFolder(session, folder, folder.access)) {
      throw new ApiError(403, 'Bu klasörü yönetme yetkiniz yok');
    }

    if (body.minLevel && LEVEL_ORDER[body.minLevel] > LEVEL_ORDER[levelOf(session.role)]) {
      throw new ApiError(403, 'Kendi seviyenizden yüksek bir erişim seviyesi belirleyemezsiniz');
    }

    // Şifre işlemleri
    let passwordHash: string | null | undefined = undefined; // undefined = dokunma
    if (body.password === null) {
      if (!isAdmin(session)) {
        throw new ApiError(403, 'Klasör şifresini yalnızca Baş Yönetici kaldırabilir');
      }
      passwordHash = null;
      await audit(session, 'updated', 'folder', folder.id, `Klasör şifresi KALDIRILDI: ${folder.name}`);
    } else if (typeof body.password === 'string') {
      if (folder.passwordHash && !isAdmin(session)) {
        throw new ApiError(403, 'Mevcut klasör şifresini yalnızca Baş Yönetici sıfırlayabilir');
      }
      passwordHash = await bcrypt.hash(body.password, 10);
      await audit(
        session, 'updated', 'folder', folder.id,
        `Klasör şifresi ${folder.passwordHash ? 'SIFIRLANDI' : 'AYARLANDI'}: ${folder.name}`
      );
    }

    // ACL değiştirme (verildiyse tümüyle yenilenir)
    const entries = body.userIds !== undefined ? normalizeAccessEntries(body.userIds) : undefined;
    if (entries) {
      await assertGrantableUsers(session, entries.map((e) => e.userId));
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (entries) {
        await tx.folderAccess.deleteMany({ where: { folderId: folder.id } });
        if (entries.length) {
          await tx.folderAccess.createMany({
            data: entries.map((e) => ({ folderId: folder.id, userId: e.userId, canWrite: e.canWrite })),
          });
        }
      }
      return tx.folder.update({
        where: { id: folder.id },
        data: {
          name: body.name,
          minLevel: body.minLevel,
          restricted: body.restricted,
          ...(passwordHash !== undefined ? { passwordHash } : {}),
        },
        include: { access: { select: { userId: true, canWrite: true } } },
      });
    });

    await audit(session, 'updated', 'folder', updated.id, `Klasör güncellendi: ${updated.name}`);

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      parentId: updated.parentId,
      minLevel: updated.minLevel,
      restricted: updated.restricted,
      locked: !!updated.passwordHash,
      access: updated.access,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    return handleApiError(error, 'Klasör güncellenemedi');
  }
}

/**
 * DELETE /api/folders/[id] — yumuşak silme; içindeki dokümanlar da yumuşak silinir.
 * Silinmemiş alt klasörü varsa engellenir.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;

    const folder = await loadFolder(params.id);
    if (!folder) throw new ApiError(404, 'Klasör bulunamadı');
    if (!isAdmin(session) && !canSeeFolder(session, folder, folder.access)) {
      throw new ApiError(403, 'Bu klasörü silme yetkiniz yok');
    }

    const childCount = await prisma.folder.count({
      where: { parentId: folder.id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new ApiError(400, 'Bu klasörün içinde alt klasörler var — önce onları silin veya taşıyın');
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.folder.update({ where: { id: folder.id }, data: { deletedAt: now } }),
      prisma.document.updateMany({
        where: { folderId: folder.id, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    await audit(session, 'deleted', 'folder', folder.id, `Klasör silindi (soft): ${folder.name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Klasör silinemedi');
  }
}
