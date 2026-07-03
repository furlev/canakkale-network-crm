import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, handleApiError } from '@/lib/api';
import { analyzeArticle, AiNotConfiguredError } from '@/lib/ai';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { safeEqual } from '@/lib/secure';

const schema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

/**
 * Haber/makale AI analizi (özet, SEO, etiket, sosyal metin).
 * Erişim: oturum (CRM içi) VEYA `Authorization: Bearer <WEBHOOK_SECRET>`
 * (WordPress eklentisi editörden çağırır). proxy.ts'de muaf tutulur.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const secretOk = safeEqual(bearer, process.env.WEBHOOK_SECRET); // WP eklentisi (server-to-server)
    // Oturum yolu: yalnızca ekip lideri/yönetici (ücretli AI'ı C kullanıcısı tetiklemesin)
    if (!secretOk && !isLeaderOrAdmin(session)) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    }

    const body = await parseBody(request, schema);
    const analysis = await analyzeArticle(body.title, body.content);
    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'Haber analizi başarısız');
  }
}
