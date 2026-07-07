import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { teamUpdate } from '@/lib/schemas';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

const safeSelect = {
  id: true, email: true, name: true, role: true, department: true,
  title: true, managerId: true,
  status: true, avatar: true, createdAt: true, updatedAt: true,
  manager: { select: { id: true, name: true } },
  _count: { select: { teamMembers: true, warnsReceived: true } },
};

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (session?.role !== 'admin') throw new ApiError(403, 'Bu işlem için yönetici yetkisi gerekli');

    const body = await parseBody(request, teamUpdate);
    const params = await context.params;
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: body.name,
        email: body.email,
        role: body.role,
        department: body.department,
        title: body.title,
        managerId: body.managerId,
        status: body.status,
        password: body.password ? await bcrypt.hash(body.password, 12) : undefined,
      },
      select: safeSelect,
    });
    await audit(session, 'updated', 'team', updated.id,
      `Ekip üyesi güncellendi: ${updated.name}${body.role ? ` (rol: ${body.role})` : ''}${body.password ? ' (şifre değişti)' : ''}`);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Ekip üyesi güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (session?.role !== 'admin') throw new ApiError(403, 'Bu işlem için yönetici yetkisi gerekli');

    const params = await context.params;
    if (session.sub === params.id) throw new ApiError(400, 'Kendi hesabınızı silemezsiniz');

    await prisma.user.delete({ where: { id: params.id } });
    await audit(session, 'deleted', 'team', params.id, 'Ekip üyesi silindi');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Ekip üyesi silinemedi');
  }
}
