import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { audit } from '@/lib/audit';
import {
  depotDocumentCreate,
  assertFolderRead,
  assertFolderWrite,
} from '@/lib/depot';

async function loadFolderWithAccess(id: string) {
  return prisma.folder.findFirst({
    where: { id },
    include: { access: { select: { userId: true, canWrite: true } } },
  });
}

/** Yükleyen kullanıcı adlarını tek sorguda toplayıp dokümanlara iliştirir. */
async function attachUploaderNames<T extends { uploadedById: string | null }>(items: T[]) {
  const ids = [...new Set(items.map((d) => d.uploadedById).filter((v): v is string => !!v))];
  if (ids.length === 0) return items.map((d) => ({ ...d, uploadedByName: null as string | null }));
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  return items.map((d) => ({ ...d, uploadedByName: d.uploadedById ? nameOf.get(d.uploadedById) ?? null : null }));
}

/**
 * GET /api/documents?folderId= — klasördeki (veya kökteki) dokümanlar.
 * Kök (folderId yok) herkese açık genel alandır. Klasör şifreliyse x-folder-token gerekir.
 */
export async function GET(request: Request) {
  try {
    const session = await requireLevel('C');
    const url = new URL(request.url);
    const folderId = url.searchParams.get('folderId') || null;

    if (folderId) {
      const folder = await loadFolderWithAccess(folderId);
      if (!folder || folder.deletedAt) return listResponse([]);
      assertFolderRead(session, request, folder);
    }

    const pagination = getPagination(request);
    const where = { folderId, deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.document.findMany({ where, orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.document.count({ where }) : Promise.resolve(undefined),
    ]);
    return listResponse(await attachUploaderNames(items), total);
  } catch (error) {
    return handleApiError(error, 'Dokümanlar alınamadı');
  }
}

/**
 * POST /api/documents — bağlantı/metadata tabanlı kayıt (Drive'a yüklemeden; eski UI ile uyumlu).
 * Kökte yazma B+ ister; klasörlerde klasörün yazma kuralı + (şifreliyse) token geçerlidir.
 */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('C');
    const body = await parseBody(request, depotDocumentCreate);

    let folderId: string | null = null;
    if (body.folderId) {
      const folder = await loadFolderWithAccess(body.folderId);
      assertFolderWrite(session, request, folder);
      folderId = body.folderId;
    } else {
      assertFolderWrite(session, request, null);
    }

    const created = await prisma.document.create({
      data: {
        name: body.name,
        type: body.type || 'other',
        size: body.size ?? 0,
        url: body.url || null,
        folderId,
        uploadedById: session.sub,
      },
    });
    await audit(session, 'created', 'document', created.id, `Doküman eklendi (bağlantı): ${created.name}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Doküman oluşturulamadı');
  }
}
