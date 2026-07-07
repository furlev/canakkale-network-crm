import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel } from '@/lib/api';

export async function PUT() {
  try {
    await requireLevel('C');
    await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Bildirimler okundu işaretlenemedi');
  }
}
