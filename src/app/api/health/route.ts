import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Sağlık kontrolü: uygulama ayakta mı + veritabanına ulaşılıyor mu. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Veritabanına ulaşılamıyor' }, { status: 503 });
  }
}
