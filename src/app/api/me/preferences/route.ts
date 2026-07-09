import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireLevel, handleApiError, parseBody } from '@/lib/api';

/**
 * Kullanıcının bildirim tercihleri (User.notifyPrefs, JSON string).
 * Kategori bazlı görünürlük + basit kanal/ses tercihleri. Sır tutmaz.
 */
const CATEGORIES = ['invoice', 'tip', 'ai', 'task', 'site', 'client', 'news'] as const;

type Prefs = {
  categories: Record<string, boolean>;
  sound: boolean;
  desktop: boolean;
};

function defaults(): Prefs {
  const categories: Record<string, boolean> = {};
  for (const c of CATEGORIES) categories[c] = true;
  return { categories, sound: false, desktop: true };
}

function parsePrefs(raw: string | null | undefined): Prefs {
  const base = defaults();
  if (!raw) return base;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      if (obj.categories && typeof obj.categories === 'object') {
        for (const c of CATEGORIES) {
          if (typeof obj.categories[c] === 'boolean') base.categories[c] = obj.categories[c];
        }
      }
      if (typeof obj.sound === 'boolean') base.sound = obj.sound;
      if (typeof obj.desktop === 'boolean') base.desktop = obj.desktop;
    }
  } catch { /* bozuk JSON = varsayılan */ }
  return base;
}

// GET /api/me/preferences -> { categories, sound, desktop }
export async function GET() {
  try {
    const session = await requireLevel('C');
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { notifyPrefs: true },
    });
    return NextResponse.json(parsePrefs(user?.notifyPrefs));
  } catch (error) {
    return handleApiError(error, 'Tercihler alınamadı');
  }
}

const prefsSchema = z.object({
  categories: z.record(z.string(), z.boolean()).optional(),
  sound: z.boolean().optional(),
  desktop: z.boolean().optional(),
});

// PUT /api/me/preferences  (kısmi güncelleme; mevcut değerlerle birleştirir)
export async function PUT(request: Request) {
  try {
    const session = await requireLevel('C');
    const body = await parseBody(request, prefsSchema);

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { notifyPrefs: true },
    });
    const current = parsePrefs(user?.notifyPrefs);

    const next: Prefs = {
      categories: { ...current.categories },
      sound: typeof body.sound === 'boolean' ? body.sound : current.sound,
      desktop: typeof body.desktop === 'boolean' ? body.desktop : current.desktop,
    };
    if (body.categories) {
      for (const c of CATEGORIES) {
        if (typeof body.categories[c] === 'boolean') next.categories[c] = body.categories[c];
      }
    }

    await prisma.user.update({
      where: { id: session.sub },
      data: { notifyPrefs: JSON.stringify(next) },
    });
    return NextResponse.json(next);
  } catch (error) {
    return handleApiError(error, 'Tercihler kaydedilemedi');
  }
}
