import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { folderUnlock, canSeeFolder, signFolderToken } from '@/lib/depot';

/**
 * POST /api/folders/[id]/unlock {password} → {token, expiresAt}
 *
 * Şifre bcrypt ile doğrulanır; başarılıysa 30 dk geçerli HMAC token döner.
 * Token, içerik listeleme ve indirme isteklerinde `x-folder-token` başlığıyla gönderilir.
 * Not: A (admin) dahil herkes içerik için şifreyi bilmek zorundadır (tasarım gereği mahremiyet);
 * A yalnızca klasör PUT'u ile şifreyi sıfırlayabilir/kaldırabilir (denetim kaydına düşer).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('C');
    const params = await context.params;
    const body = await parseBody(request, folderUnlock);

    const folder = await prisma.folder.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { access: { select: { userId: true, canWrite: true } } },
    });
    if (!folder) throw new ApiError(404, 'Klasör bulunamadı');
    if (!canSeeFolder(session, folder, folder.access)) {
      throw new ApiError(403, 'Bu klasöre erişim yetkiniz yok');
    }
    if (!folder.passwordHash) {
      throw new ApiError(400, 'Bu klasör şifreli değil');
    }

    const ok = await bcrypt.compare(body.password, folder.passwordHash);
    if (!ok) throw new ApiError(403, 'Şifre hatalı');

    const { token, expiresAt } = signFolderToken(folder.id, session.sub);
    return NextResponse.json({ token, expiresAt });
  } catch (error) {
    return handleApiError(error, 'Klasör kilidi açılamadı');
  }
}
