import { NextResponse } from 'next/server';
import { getWpConfig, wpFetch } from '@/lib/wordpress';
import { handleApiError } from '@/lib/api';

type WpStats = {
  total_published: number;
  total_draft: number;
  today: number;
  this_week: number;
};

export async function POST() {
  try {
    const config = await getWpConfig();
    await wpFetch(config, '/ping');

    // Ping ok — pull headline stats for a richer success message
    let stats: WpStats | null = null;
    try {
      stats = await wpFetch<WpStats>(config, '/stats');
    } catch {
      // stats failing shouldn't fail the connection test
    }

    return NextResponse.json({
      ok: true,
      message: 'Bağlantı başarılı',
      site: config.url,
      stats,
    });
  } catch (error) {
    return handleApiError(error, 'WordPress bağlantı testi başarısız');
  }
}
