/**
 * Depo (dosya deposu) modülü — erişim mantığı + zod şemaları + kilitli klasör token'ları.
 *
 * Erişim modeli:
 *   - A (admin) her klasörü görür ve yönetir.
 *   - Görünürlük: levelOf(role) >= folder.minLevel VE (restricted değil VEYA FolderAccess kaydı var).
 *   - Yazma: A, veya FolderAccess.canWrite, veya görünürlüğü olan B+. C görünür yerde bile salt-okurdur.
 *   - Klasör yönetimi (oluştur/düzenle/ACL): B+. B yalnızca kendi ekibine (managerId == kendisi) erişim verebilir.
 *
 * Şifreli klasörler: passwordHash (bcrypt) doluysa içerik listeleme + indirme için
 * `x-folder-token` başlığında HMAC token gerekir (30 dk geçerli). Klasör ADLARI şifresiz listelenir.
 */
import { createHmac } from 'crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ApiError } from '@/lib/api';
import { levelOf, isAdmin, hasLevel, type AccessLevel } from '@/lib/permissions';
import { safeEqual } from '@/lib/secure';
import type { Session } from '@/lib/auth';

export const LEVEL_ORDER: Record<AccessLevel, number> = { C: 0, B: 1, A: 2 };

/** Prisma Folder kaydının erişim kararı için gereken asgari alanları. */
export type DepotFolder = {
  id: string;
  minLevel: string;
  restricted: boolean;
  passwordHash?: string | null;
  createdById?: string | null;
};

export type DepotAccessRow = { userId: string; canWrite: boolean };

function toLevel(value: string | null | undefined): AccessLevel {
  return value === 'A' || value === 'B' ? value : 'C';
}

/** Kullanıcı bu klasörü görebilir mi? (A her şeyi görür.) */
export function canSeeFolder(
  session: Session,
  folder: DepotFolder,
  accessRows: DepotAccessRow[]
): boolean {
  if (isAdmin(session)) return true;
  const myLevel = levelOf(session.role);
  if (LEVEL_ORDER[myLevel] < LEVEL_ORDER[toLevel(folder.minLevel)]) return false;
  if (folder.restricted) return accessRows.some((a) => a.userId === session.sub);
  return true;
}

/** Kullanıcı bu klasörün İÇİNE yazabilir mi? (yükleme / yeniden adlandırma / silme) */
export function canWriteFolder(
  session: Session,
  folder: DepotFolder,
  accessRows: DepotAccessRow[]
): boolean {
  if (isAdmin(session)) return true;
  if (!canSeeFolder(session, folder, accessRows)) return false;
  if (accessRows.some((a) => a.userId === session.sub && a.canWrite)) return true;
  // B+ görünürlükle birlikte yazabilir; C salt-okur.
  return hasLevel(session, 'B');
}

/** Klasör yönetimi (oluştur/düzenle/ACL) yalnızca B+ içindir. */
export function canManageFolders(session: Session): boolean {
  return hasLevel(session, 'B');
}

/**
 * B kullanıcısı yalnızca kendi ekibindeki (managerId == kendisi) kullanıcılara veya
 * kendisine FolderAccess verebilir; A herkese verebilir. Aksi halde ApiError fırlatır.
 */
export async function assertGrantableUsers(session: Session, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, managerId: true },
  });
  if (users.length !== userIds.length) {
    throw new ApiError(400, 'Erişim listesindeki bazı kullanıcılar bulunamadı');
  }
  if (isAdmin(session)) return;
  const bad = users.filter((u) => u.managerId !== session.sub && u.id !== session.sub);
  if (bad.length > 0) {
    throw new ApiError(403, 'Yalnızca kendi ekibinizdeki kullanıcılara klasör erişimi verebilirsiniz');
  }
}

/* ── Kilitli klasör token'ları: HMAC-SHA256(AUTH_SECRET), 30 dk ── */

const FOLDER_TOKEN_TTL_MS = 30 * 60 * 1000;

function hmacHex(payload: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET tanımlı değil — klasör token\'ı üretilemiyor');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Şifre doğrulandıktan sonra üretilen kısa ömürlü erişim token'ı. */
export function signFolderToken(folderId: string, userId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + FOLDER_TOKEN_TTL_MS;
  const sig = hmacHex(`folder:${folderId}:${userId}:${expiresAt}`);
  return { token: `${expiresAt}.${sig}`, expiresAt };
}

export function verifyFolderToken(token: string, folderId: string, userId: string): boolean {
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expiresAt = Number.parseInt(token.slice(0, dot), 10);
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  try {
    return safeEqual(sig, hmacHex(`folder:${folderId}:${userId}:${expiresAt}`));
  } catch {
    return false;
  }
}

/**
 * Klasör şifreliyse istekte geçerli bir token arar (x-folder-token başlığı — birden çok
 * token virgülle ayrılabilir; ?token= sorgu parametresi de kabul edilir). Yoksa 423 fırlatır.
 */
export function requireFolderToken(
  request: Request,
  folder: Pick<DepotFolder, 'id' | 'passwordHash'>,
  session: Session
): void {
  if (!folder.passwordHash) return;
  const header = request.headers.get('x-folder-token') || '';
  const query = new URL(request.url).searchParams.get('token') || '';
  const candidates = `${header},${query}`.split(',').map((t) => t.trim()).filter(Boolean);
  const ok = candidates.some((t) => verifyFolderToken(t, folder.id, session.sub));
  if (!ok) {
    throw new ApiError(423, 'Bu klasör şifre korumalı — içeriğe erişmek için şifreyi girin');
  }
}

/* ── Ortak yazma guard'ı (dokümanlar için) ── */

type FolderWithAccess = DepotFolder & { deletedAt?: Date | null; access: DepotAccessRow[] };

/**
 * Bir doküman işlemi için hedef klasörde (null = kök/genel alan) yazma hakkı ve
 * (şifreliyse) geçerli token ister. Kökte yazma B+ ister; herkes okuyabilir.
 */
export function assertFolderWrite(
  session: Session,
  request: Request,
  folder: FolderWithAccess | null
): void {
  if (!folder) {
    if (!hasLevel(session, 'B')) {
      throw new ApiError(403, 'Genel alana yazmak için Ekip Lideri (B) yetkisi gerekli');
    }
    return;
  }
  if (folder.deletedAt) throw new ApiError(404, 'Klasör bulunamadı');
  if (!canSeeFolder(session, folder, folder.access)) {
    throw new ApiError(403, 'Bu klasöre erişim yetkiniz yok');
  }
  requireFolderToken(request, folder, session);
  if (!canWriteFolder(session, folder, folder.access)) {
    throw new ApiError(403, 'Bu klasörde yazma yetkiniz yok');
  }
}

/** Görünürlük + (şifreliyse) token — okuma yolları için. */
export function assertFolderRead(
  session: Session,
  request: Request,
  folder: FolderWithAccess | null
): void {
  if (!folder) return; // kök: herkes görür
  if (folder.deletedAt) throw new ApiError(404, 'Klasör bulunamadı');
  if (!canSeeFolder(session, folder, folder.access)) {
    throw new ApiError(403, 'Bu klasöre erişim yetkiniz yok');
  }
  requireFolderToken(request, folder, session);
}

/* ── Dosya türü tespiti ── */

export function docTypeFromFile(mime: string | null | undefined, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const m = mime || '';
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (m.includes('word') || ['doc', 'docx'].includes(ext)) return 'word';
  if (m.includes('sheet') || m.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
  return 'other';
}

/* ── Zod şemaları (bu modüle özel — src/lib/schemas.ts'e dokunulmaz) ── */

const levelEnum = z.enum(['A', 'B', 'C']);

/** ACL girdisi: düz userId string'i (canWrite=false) veya {userId, canWrite}. */
const accessEntry = z.union([
  z.string().min(1),
  z.object({ userId: z.string().min(1), canWrite: z.boolean().optional() }),
]);

export type NormalizedAccessEntry = { userId: string; canWrite: boolean };

export function normalizeAccessEntries(
  entries: Array<string | { userId: string; canWrite?: boolean }> | undefined
): NormalizedAccessEntry[] {
  const map = new Map<string, boolean>();
  for (const e of entries ?? []) {
    const userId = typeof e === 'string' ? e : e.userId;
    const canWrite = typeof e === 'string' ? false : !!e.canWrite;
    map.set(userId, (map.get(userId) ?? false) || canWrite);
  }
  return [...map.entries()].map(([userId, canWrite]) => ({ userId, canWrite }));
}

export const folderCreate = z.object({
  name: z.string().min(1).max(150),
  parentId: z.string().min(1).optional().nullable(),
  minLevel: levelEnum.optional(),
  restricted: z.boolean().optional(),
  password: z.string().min(4).max(72).optional().nullable(),
  userIds: z.array(accessEntry).optional(),
});

export const folderUpdate = z.object({
  name: z.string().min(1).max(150).optional(),
  minLevel: levelEnum.optional(),
  restricted: z.boolean().optional(),
  userIds: z.array(accessEntry).optional(), // verilirse ACL tümüyle değiştirilir
  password: z.string().min(4).max(72).optional().nullable(), // string=ayarla/sıfırla, null=kaldır (yalnız A)
});

export const folderUnlock = z.object({ password: z.string().min(1) });

/** Bağlantı/metadata tabanlı doküman girişi — eski UI alanlarıyla geriye uyumlu. */
export const depotDocumentCreate = z.object({
  name: z.string().min(1),
  type: z.enum(['pdf', 'word', 'excel', 'image', 'other']).optional(),
  size: z.coerce.number().int().min(0).optional(),
  url: z.string().optional().nullable(),
  folderId: z.string().min(1).optional().nullable(),
});

export const depotDocumentUpdate = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['pdf', 'word', 'excel', 'image', 'other']).optional(),
  url: z.string().optional().nullable(),
  folderId: z.string().min(1).optional().nullable(), // null = köke taşı
});
