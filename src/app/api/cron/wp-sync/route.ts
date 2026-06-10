import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getWpConfig, syncWpPosts } from '@/lib/wordpress';
import { handleApiError } from '@/lib/api';

export const maxDuration = 60;

/**
 * Zamanlanmış WordPress senkronu (GitHub Actions / harici cron).
 * `Authorization: Bearer <CRON_SECRET>` ister; Ayarlar'daki
 * "Otomatik haber çekme" kapalıysa atlar.
 */
export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || bearer !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  try {
    // Ayarlar'daki otomatik çekme toggle'ına saygı göster
    const row = await prisma.setting.findUnique({ where: { key: 'wordpress' } });
    if (row) {
      try {
        const wp = JSON.parse(row.value);
        if (wp.autoFetch === false) {
          return NextResponse.json({ ok: true, skipped: true, message: 'Otomatik haber çekme kapalı' });
        }
      } catch { /* bozuk ayar = devam */ }
    }

    const config = await getWpConfig();
    const { created, updated } = await syncWpPosts(config);
    return NextResponse.json({ ok: true, created, updated });
  } catch (error) {
    return handleApiError(error, 'Zamanlanmış WordPress senkronu başarısız');
  }
}
