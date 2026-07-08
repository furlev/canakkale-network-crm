import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { assertFolderWrite, docTypeFromFile } from '@/lib/depot';
import { isDriveConfigured, driveUpload } from '@/lib/drive';

export const maxDuration = 300; // büyük dosyalar için

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * POST /api/documents/upload — multipart FormData (file, folderId?).
 * Yazma hakkı + (şifreli klasörse) x-folder-token ister; dosyayı Google Drive'a yükler
 * ve Document kaydını oluşturur.
 */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('C');

    if (!isDriveConfigured()) {
      throw new ApiError(503, 'Google Drive bağlı değil (GOOGLE_DRIVE_CREDENTIALS_JSON eksik)');
    }

    const form = await request.formData().catch(() => {
      throw new ApiError(400, 'Geçersiz form verisi (multipart/form-data bekleniyor)');
    });

    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new ApiError(400, 'Dosya bulunamadı (form alanı: file)');
    }
    const folderIdRaw = form.get('folderId');
    const folderId = typeof folderIdRaw === 'string' && folderIdRaw.trim() ? folderIdRaw.trim() : null;

    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      throw new ApiError(413, `Dosya çok büyük (${mb} MB) — en fazla 100 MB yükleyebilirsiniz`);
    }

    let folder = null;
    if (folderId) {
      folder = await prisma.folder.findFirst({
        where: { id: folderId },
        include: { access: { select: { userId: true, canWrite: true } } },
      });
      if (!folder || folder.deletedAt) throw new ApiError(404, 'Klasör bulunamadı');
    }
    assertFolderWrite(session, request, folder);

    const mime = file.type || 'application/octet-stream';
    const buffer = Buffer.from(await file.arrayBuffer());
    // Klasörün eşlenik Drive klasörü varsa oraya yükle; yoksa köke (driveUpload varsayılanı)
    const uploaded = await driveUpload(file.name, mime, buffer, folder?.driveFolderId || undefined);

    const created = await prisma.document.create({
      data: {
        name: file.name,
        type: docTypeFromFile(mime, file.name),
        size: file.size,
        mime,
        driveFileId: uploaded.id,
        uploadedById: session.sub,
        folderId,
      },
    });

    await audit(
      session, 'uploaded', 'document', created.id,
      `Drive'a yüklendi: ${created.name} (${(file.size / 1024).toFixed(0)} KB${folder ? `, klasör: ${folder.name}` : ', genel alan'})`
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Dosya yüklenemedi');
  }
}
