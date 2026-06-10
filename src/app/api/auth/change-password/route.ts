import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { changePasswordSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, 'Oturum gerekli');

    const body = await parseBody(request, changePasswordSchema);

    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user) throw new ApiError(404, 'Kullanıcı bulunamadı');

    // Mevcut şifresi olan kullanıcı eskisini doğrulamak zorunda
    if (user.password) {
      if (!body.currentPassword) throw new ApiError(400, 'Mevcut şifrenizi girin');
      const ok = await bcrypt.compare(body.currentPassword, user.password);
      if (!ok) throw new ApiError(401, 'Mevcut şifre hatalı');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(body.newPassword, 12) },
    });

    return NextResponse.json({ success: true, message: 'Şifreniz güncellendi' });
  } catch (error) {
    return handleApiError(error, 'Şifre değiştirilemedi');
  }
}
