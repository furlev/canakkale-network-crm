import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { levelOf, hasLevel } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { isDriveConfigured } from '@/lib/drive';
import {
  folderCreate,
  canSeeFolder,
  canWriteFolder,
  canManageFolders,
  assertGrantableUsers,
  normalizeAccessEntries,
  LEVEL_ORDER,
} from '@/lib/depot';

/**
 * GET /api/folders?parentId=  → görünür alt klasörler + breadcrumb + geçerli klasör bilgisi.
 * GET /api/folders?all=1      → düz görünür klasör listesi (taşıma hedefi seçici için).
 * Klasör ADLARI şifresiz listelenir; içerikler /api/documents tarafında token ister.
 */
export async function GET(request: Request) {
  try {
    const session = await requireLevel('C');
    const url = new URL(request.url);

    // Düz liste modu (taşı / üst klasör seçicileri)
    if (url.searchParams.get('all')) {
      const folders = await prisma.folder.findMany({
        where: { deletedAt: null },
        include: { access: { select: { userId: true, canWrite: true } } },
        orderBy: { name: 'asc' },
      });
      const visible = folders
        .filter((f) => canSeeFolder(session, f, f.access))
        .map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          locked: !!f.passwordHash,
          canWrite: canWriteFolder(session, f, f.access),
        }));
      return NextResponse.json(visible);
    }

    const parentId = url.searchParams.get('parentId') || null;

    // Geçerli klasör (kök değilse): görünürlük şart, ad/durum bilgisi döner
    let current: {
      id: string; name: string; parentId: string | null; minLevel: string;
      restricted: boolean; locked: boolean; canWrite: boolean;
      access: { userId: string; canWrite: boolean }[];
    } | null = null;

    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: parentId, deletedAt: null },
        include: { access: { select: { userId: true, canWrite: true } } },
      });
      if (!parent) throw new ApiError(404, 'Klasör bulunamadı');
      if (!canSeeFolder(session, parent, parent.access)) {
        throw new ApiError(403, 'Bu klasöre erişim yetkiniz yok');
      }
      current = {
        id: parent.id,
        name: parent.name,
        parentId: parent.parentId,
        minLevel: parent.minLevel,
        restricted: parent.restricted,
        locked: !!parent.passwordHash,
        canWrite: canWriteFolder(session, parent, parent.access),
        access: canManageFolders(session) ? parent.access : [],
      };
    }

    // Breadcrumb: geçerli klasörden köke doğru (döngü koruması: en fazla 25 seviye)
    const breadcrumb: { id: string; name: string; locked: boolean }[] = [];
    let cursorId: string | null = parentId;
    for (let i = 0; i < 25 && cursorId; i++) {
      const node: { id: string; name: string; parentId: string | null; passwordHash: string | null } | null =
        await prisma.folder.findUnique({
          where: { id: cursorId },
          select: { id: true, name: true, parentId: true, passwordHash: true },
        });
      if (!node) break;
      breadcrumb.unshift({ id: node.id, name: node.name, locked: !!node.passwordHash });
      cursorId = node.parentId;
    }

    const children = await prisma.folder.findMany({
      where: { parentId, deletedAt: null },
      include: {
        access: { select: { userId: true, canWrite: true } },
        _count: {
          select: {
            documents: { where: { deletedAt: null } },
            children: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const canManage = canManageFolders(session);
    const folders = children
      .filter((f) => canSeeFolder(session, f, f.access))
      .map((f) => ({
        id: f.id,
        name: f.name,
        minLevel: f.minLevel,
        restricted: f.restricted,
        locked: !!f.passwordHash,
        canWrite: canWriteFolder(session, f, f.access),
        canManage,
        counts: { documents: f._count.documents, folders: f._count.children },
        access: canManage ? f.access : [],
        createdAt: f.createdAt,
      }));

    return NextResponse.json({
      folders,
      breadcrumb,
      current,
      // Kökte yazma B+ ister; klasör içindeyse klasörün kendi kuralı geçerli
      canWrite: current ? current.canWrite : hasLevel(session, 'B'),
      canManage,
      driveConfigured: isDriveConfigured(),
    });
  } catch (error) {
    return handleApiError(error, 'Klasörler alınamadı');
  }
}

/** POST /api/folders — yeni klasör (B+). */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, folderCreate);

    const minLevel = body.minLevel ?? 'C';
    const myLevel = levelOf(session.role);
    if (LEVEL_ORDER[minLevel] > LEVEL_ORDER[myLevel]) {
      throw new ApiError(403, 'Kendi seviyenizden yüksek bir erişim seviyesi belirleyemezsiniz');
    }

    if (body.parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: body.parentId, deletedAt: null },
        include: { access: { select: { userId: true, canWrite: true } } },
      });
      if (!parent) throw new ApiError(404, 'Üst klasör bulunamadı');
      if (!canSeeFolder(session, parent, parent.access)) {
        throw new ApiError(403, 'Üst klasöre erişim yetkiniz yok');
      }
    }

    const entries = normalizeAccessEntries(body.userIds);
    await assertGrantableUsers(session, entries.map((e) => e.userId));

    const created = await prisma.folder.create({
      data: {
        name: body.name,
        parentId: body.parentId || null,
        minLevel,
        restricted: body.restricted ?? false,
        passwordHash: body.password ? await bcrypt.hash(body.password, 10) : null,
        createdById: session.sub,
        access: entries.length
          ? { create: entries.map((e) => ({ userId: e.userId, canWrite: e.canWrite })) }
          : undefined,
      },
      include: { access: { select: { userId: true, canWrite: true } } },
    });

    await audit(
      session, 'created', 'folder', created.id,
      `Klasör: ${created.name} (minLevel: ${created.minLevel}, kısıtlı: ${created.restricted ? 'evet' : 'hayır'}, şifreli: ${created.passwordHash ? 'evet' : 'hayır'})`
    );

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        parentId: created.parentId,
        minLevel: created.minLevel,
        restricted: created.restricted,
        locked: !!created.passwordHash,
        access: created.access,
        createdAt: created.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'Klasör oluşturulamadı');
  }
}
