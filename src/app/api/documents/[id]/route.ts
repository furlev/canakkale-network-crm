import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { depotDocumentUpdate, assertFolderWrite } from '@/lib/depot';
import type { Session } from '@/lib/auth';

async function loadFolderWithAccess(id: string) {
  return prisma.folder.findFirst({
    where: { id },
    include: { access: { select: { userId: true, canWrite: true } } },
  });
}

/** Dokümanı yükler ve bulunduğu klasörde yazma hakkı (+ şifreliyse token) ister. */
async function loadDocForWrite(session: Session, request: Request, id: string) {
  const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
  if (!doc) throw new ApiError(404, 'Doküman bulunamadı');
  const folder = doc.folderId ? await loadFolderWithAccess(doc.folderId) : null;
  if (doc.folderId && !folder) throw new ApiError(404, 'Doküman bulunamadı');
  assertFolderWrite(session, request, folder);
  return doc;
}

/**
 * PUT /api/documents/[id] — yeniden adlandırma / taşıma.
 * Taşıma, hem kaynak hem hedef klasörde yazma hakkı ister (şifrelilerde token dahil;
 * x-folder-token başlığı virgülle ayrılmış birden çok token taşıyabilir).
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('C');
    const params = await context.params;
    const body = await parseBody(request, depotDocumentUpdate);

    const doc = await loadDocForWrite(session, request, params.id);

    // Taşıma: hedef klasörde de yazma hakkı gerekir (null = kök)
    let folderId: string | null | undefined = undefined;
    if (body.folderId !== undefined && body.folderId !== doc.folderId) {
      if (body.folderId === null) {
        assertFolderWrite(session, request, null);
        folderId = null;
      } else {
        const target = await loadFolderWithAccess(body.folderId);
        if (!target || target.deletedAt) throw new ApiError(404, 'Hedef klasör bulunamadı');
        assertFolderWrite(session, request, target);
        folderId = body.folderId;
      }
    }

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        name: body.name,
        type: body.type,
        url: body.url,
        ...(folderId !== undefined ? { folderId } : {}),
      },
    });
    if (folderId !== undefined) {
      await audit(session, 'updated', 'document', updated.id, `Doküman taşındı: ${updated.name}`);
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Doküman güncellenemedi');
  }
}

/** DELETE /api/documents/[id] — yumuşak silme (deletedAt). */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('C');
    const params = await context.params;

    const doc = await loadDocForWrite(session, request, params.id);
    await prisma.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
    await audit(session, 'deleted', 'document', doc.id, `Doküman silindi (soft): ${doc.name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Doküman silinemedi');
  }
}
