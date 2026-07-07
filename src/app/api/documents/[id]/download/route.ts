import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel, ApiError } from '@/lib/api';
import { assertFolderRead } from '@/lib/depot';
import { driveDownload } from '@/lib/drive';

export const maxDuration = 300; // büyük dosya stream'leri için

/** RFC 5987 uyumlu Content-Disposition (Türkçe dosya adları için). */
function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * GET /api/documents/[id]/download — erişim kontrolü (klasör görünürlüğü + şifreliyse token,
 * x-folder-token başlığı veya ?token= parametresi) sonrası:
 *   - driveFileId varsa Drive'dan stream eder,
 *   - data: URI ise çözer ve döndürür,
 *   - normal URL ise oraya yönlendirir.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('C');
    const params = await context.params;

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

    // 1) Google Drive dosyası → stream
    if (doc.driveFileId) {
      const driveRes = await driveDownload(doc.driveFileId);
      const headers = new Headers();
      headers.set('Content-Type', doc.mime || driveRes.headers.get('content-type') || 'application/octet-stream');
      headers.set('Content-Disposition', contentDisposition(doc.name));
      const len = driveRes.headers.get('content-length');
      if (len) headers.set('Content-Length', len);
      headers.set('Cache-Control', 'private, no-store');
      return new Response(driveRes.body, { status: 200, headers });
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
            'Content-Disposition': contentDisposition(doc.name),
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
