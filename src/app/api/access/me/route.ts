import { NextResponse } from 'next/server';
import { handleApiError, requireLevel } from '@/lib/api';
import { MANAGED_PATHS, effectivePaths } from '@/lib/access';

/** Oturumdaki kullanıcının erişebildiği ekranlar (nav filtrelemesi için). */
export async function GET() {
  try {
    const session = await requireLevel();
    const paths = await effectivePaths(session);
    return NextResponse.json({ paths, managed: MANAGED_PATHS });
  } catch (error) {
    return handleApiError(error, 'Erişim bilgisi alınamadı');
  }
}
