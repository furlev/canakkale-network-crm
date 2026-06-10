import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/** Lightweight badge endpoint — avoids downloading the whole tip list every poll. */
export async function GET() {
  try {
    const newCount = await prisma.tip.count({ where: { status: 'new' } });
    return NextResponse.json({ new: newCount });
  } catch (error) {
    console.error('[api] tips/count:', error);
    return NextResponse.json({ error: 'Sayım alınamadı' }, { status: 500 });
  }
}
