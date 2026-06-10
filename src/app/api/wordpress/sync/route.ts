import { NextResponse } from 'next/server';
import { getWpConfig, syncWpPosts } from '@/lib/wordpress';
import { handleApiError } from '@/lib/api';

export async function POST() {
  try {
    const config = await getWpConfig();
    const { created, updated } = await syncWpPosts(config);

    return NextResponse.json({
      ok: true,
      created,
      updated,
      message: `${created} yeni haber eklendi, ${updated} haber güncellendi`,
    });
  } catch (error) {
    return handleApiError(error, 'WordPress senkronizasyonu başarısız');
  }
}
