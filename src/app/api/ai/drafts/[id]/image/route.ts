import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';

/** Taslağın "temsili" görselini servis eder. Listede base64 taşımamak için
 *  görsel bu uçtan ayrıca yüklenir (data URI → binary; http(s) URL → redirect). */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const { id } = await context.params;
    const draft = await prisma.aiDraft.findUnique({ where: { id }, select: { imageUrl: true } });
    if (!draft || !draft.imageUrl) throw new ApiError(404, 'Görsel bulunamadı');

    // Dış URL ise oraya yönlendir
    if (/^https?:\/\//i.test(draft.imageUrl)) {
      return NextResponse.redirect(draft.imageUrl);
    }

    // data:image/...;base64,... → binary olarak döndür
    const m = draft.imageUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i);
    if (!m) throw new ApiError(404, 'Görsel biçimi desteklenmiyor');

    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length === 0) throw new ApiError(404, 'Görsel verisi boş/bozuk');

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': m[1],
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    return handleApiError(error, 'Görsel alınamadı');
  }
}
