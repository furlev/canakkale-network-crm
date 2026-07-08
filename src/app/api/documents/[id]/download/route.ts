import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel, ApiError } from '@/lib/api';
import { assertFolderRead } from '@/lib/depot';
import { driveStream } from '@/lib/drive';

export const maxDuration = 300; // büyük dosya stream'leri için

/** RFC 5987 uyumlu Content-Disposition (Türkçe dosya adları için). */
function contentDisposition(name: string, inline: boolean): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  const kind = inline ? 'inline' : 'attachment';
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * GET /api/documents/[id]/download — erişim kontrolü (klasör görünürlüğü + şifreliyse token,
 * x-folder-token başlığı veya ?token= parametresi) sonrası:
 *   - driveFileId varsa Drive'dan stream eder (HTTP Range → 206 Partial Content: video seek),
 *   - data: URI ise çözer ve döndürür,
 *   - normal URL ise oraya yönlendirir.
 *
 * ?inline=1 → Content-Disposition: inline (tarayıcıda önizleme/oynatma).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('C');
    const params = await context.params;
    const inline = new URL(request.url).searchParams.get('inline') === '1';

    const doc = await prisma.document.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!doc) throw new ApiError(404, 'Dosya bulunamadı');

    if (doc.folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: doc.folderId },
        include: { access: { select: { userId: true, canWrite: true } } },
      });
      if (!folder || folder.deletedAt) throw new ApiError(404, 'Dosya bulunamadı');
      assertFolderRead(session, request, folder);
    }

    // 1) Google Drive dosyası → byte-serving stream (Range → 206)
    if (doc.driveFileId) {
      const range = request.headers.get('range');
      const driveRes = await driveStream(doc.driveFileId, range);
      const headers = new Headers();
      headers.set('Content-Type', doc.mime || driveRes.headers.get('content-type') || 'application/octet-stream');
      headers.set('Content-Disposition', contentDisposition(doc.name, inline));
      headers.set('Accept-Ranges', 'bytes');
      const len = driveRes.headers.get('content-length');
      if (len) headers.set('Content-Length', len);
      const contentRange = driveRes.headers.get('content-range');
      if (contentRange) headers.set('Content-Range', contentRange);
      headers.set('Cache-Control', 'private, no-store');
      // Drive durumunu aynen ilet (200 tam, 206 kısmi, 416 range geçersiz)
      return new Response(driveRes.body, { status: driveRes.status, headers });
    }

    // 2) URL tabanlı kayıt
    if (doc.url) {
      // Eski kayıtlar data: URI saklıyor olabilir — çöz ve doğrudan döndür
      if (doc.url.startsWith('data:')) {
        const match = doc.url.match(/^data:([^;,]*)?(;base64)?,([\s\S]*)$/);
        if (!match) throw new ApiError(500, 'Dosya verisi çözümlenemedi');
        const [, mime, isB64, data] = match;
        const buffer = isB64 ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data), 'utf8');
        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': doc.mime || mime || 'application/octet-stream',
            'Content-Disposition': contentDisposition(doc.name, inline),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'private, no-store',
          },
        });
      }
      try {
        return NextResponse.redirect(new URL(doc.url, request.url));
      } catch {
        throw new ApiError(400, 'Dosya bağlantısı geçersiz');
      }
    }

    throw new ApiError(404, 'Bu dosya için indirilebilir içerik yok');
  } catch (error) {
    return handleApiError(error, 'Dosya indirilemedi');
  }
}
