import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 });
  }
  // title/department JWT'de yok; DB'den okunur (RBAC etiketi + muhasebe kontrolü için)
  const user = await prisma.user
    .findUnique({ where: { id: session.sub }, select: { title: true, department: true } })
    .catch(() => null);
  return NextResponse.json({
    id: session.sub,
    name: session.name,
    email: session.email,
    role: session.role,
    title: user?.title || null,
    department: user?.department || null,
  });
}
