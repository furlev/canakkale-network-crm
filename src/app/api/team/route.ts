import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, ApiError, requireLevel } from '@/lib/api';
import { teamCreate } from '@/lib/schemas';
import { getSession } from '@/lib/auth';
import { hasLevel } from '@/lib/permissions';
import { audit } from '@/lib/audit';

// password alanı asla API'den dönmez
const safeSelect = {
  id: true, email: true, name: true, role: true, department: true,
  title: true, managerId: true,
  status: true, avatar: true, createdAt: true, updatedAt: true,
  manager: { select: { id: true, name: true } },
  _count: { select: { teamMembers: true, warnsReceived: true } },
};

export async function GET(request: Request) {
  try {
    const session = await requireLevel('C');

    // C (üye): yalnızca atama/mesaj seçim listeleri için asgari alanlar döner.
    if (!hasLevel(session, 'B')) {
      const items = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, title: true },
      });
      return listResponse(items);
    }

    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: safeSelect, ...(pagination ?? {}) }),
      pagination ? prisma.user.count() : Promise.resolve(undefined),
    ]);
    return listResponse(items, total);
  } catch (error) {
    return handleApiError(error, 'Ekip listesi alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (session?.role !== 'admin') throw new ApiError(403, 'Bu işlem için yönetici yetkisi gerekli');

    const body = await parseBody(request, teamCreate);
    const created = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        role: body.role || 'user',
        department: body.department || null,
        title: body.title || null,
        managerId: body.managerId || null,
        status: body.status || 'active',
        password: body.password ? await bcrypt.hash(body.password, 12) : null,
      },
      select: safeSelect,
    });
    await audit(session, 'created', 'team', created.id, `Yeni ekip üyesi: ${created.name} (${created.email}, rol: ${created.role})`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Ekip üyesi oluşturulamadı');
  }
}
