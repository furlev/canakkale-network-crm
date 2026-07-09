import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel } from '@/lib/api';
import { CATEGORY_OF_TYPE, categoryOf } from '@/lib/notify';

/** category filtresi → o kategoriye düşen type değerleri (eski kategorisiz kayıtlar için). */
function typesForCategory(category: string): string[] {
  return Object.entries(CATEGORY_OF_TYPE)
    .filter(([, cat]) => cat === category)
    .map(([type]) => type);
}

/**
 * Bir kategori filtresini Prisma where'ine çevirir: kayıtlı category eşleşir VEYA
 * (category boş olan eski kayıtlarda) type o kategoriye düşer.
 */
function categoryWhere(category: string): Prisma.NotificationWhereInput {
  const types = typesForCategory(category);
  const or: Prisma.NotificationWhereInput[] = [{ category }];
  if (types.length > 0) or.push({ category: null, type: { in: types } });
  return { OR: or };
}

// GET /api/notifications?limit=100&category=invoice&status=unread&mine=1
//   -> { items, unread, unreadMine }
export async function GET(request: Request) {
  try {
    const session = await requireLevel('C');
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 200);
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || 'all'; // all | unread | read
    const mine = searchParams.get('mine') === '1';

    const and: Prisma.NotificationWhereInput[] = [];
    if (category) and.push(categoryWhere(category));
    if (status === 'unread') and.push({ read: false });
    else if (status === 'read') and.push({ read: true });
    // "bana atanan": yalnızca bu kullanıcıya hedeflenmiş bildirimler
    if (mine) and.push({ userId: session.sub });

    const where: Prisma.NotificationWhereInput = and.length > 0 ? { AND: and } : {};

    const [rows, unread, unreadMine] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.notification.count({ where: { read: false } }),
      prisma.notification.count({ where: { read: false, userId: session.sub } }),
    ]);

    // Efektif kategoriyi ekle (istemci filtre çipleri için); sır dönmez.
    const items = rows.map((n) => ({ ...n, category: categoryOf(n.type, n.category) }));
    return NextResponse.json({ items, unread, unreadMine });
  } catch (error) {
    return handleApiError(error, 'Bildirimler alınamadı');
  }
}

/**
 * PATCH /api/notifications — toplu okundu işaretle.
 * Body: { ids?: string[] } belirli kayıtlar, veya { category?, mine?, all? } filtreli hepsi.
 * read-all endpoint'i (global) korunur; bu, filtreli/ seçili toplu işlemler içindir.
 */
export async function PATCH(request: Request) {
  try {
    const session = await requireLevel('C');
    let body: { ids?: unknown; category?: unknown; mine?: unknown; all?: unknown } = {};
    try { body = await request.json(); } catch { /* boş gövde = all */ }

    const where: Prisma.NotificationWhereInput = { read: false };
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const ids = body.ids.filter((x): x is string => typeof x === 'string');
      where.id = { in: ids };
    } else {
      if (typeof body.category === 'string' && body.category) {
        Object.assign(where, categoryWhere(body.category));
      }
      if (body.mine === true) where.userId = session.sub;
    }

    const res = await prisma.notification.updateMany({ where, data: { read: true } });
    return NextResponse.json({ success: true, count: res.count });
  } catch (error) {
    return handleApiError(error, 'Bildirimler okundu işaretlenemedi');
  }
}
