import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';

// GET /api/notifications?limit=20 -> { items, unread }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100);

    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.notification.count({ where: { read: false } }),
    ]);
    return NextResponse.json({ items, unread });
  } catch (error) {
    return handleApiError(error, 'Bildirimler alınamadı');
  }
}
