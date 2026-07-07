import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel } from '@/lib/api';

/** Lightweight badge endpoint — avoids downloading the whole tip list every poll. */
export async function GET() {
  try {
    await requireLevel('C');
    const newCount = await prisma.tip.count({ where: { status: 'new' } });
    return NextResponse.json({ new: newCount });
  } catch (error) {
    return handleApiError(error, 'Sayım alınamadı');
  }
}
