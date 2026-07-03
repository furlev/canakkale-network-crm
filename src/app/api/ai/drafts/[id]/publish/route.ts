import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { getWpConfig, wpFetch } from '@/lib/wordpress';

type WpCategory = { id: number; name: string; slug: string };
type WpCreatedPost = { id: number };

/** Taslak etiketlerini (JSON string dizi) güvenle çözer. */
function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Taslağı WordPress'e yayınlar ve durumunu published yapar. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const { id } = await context.params;
    const draft = await prisma.aiDraft.findUnique({ where: { id } });
    if (!draft) throw new ApiError(404, 'Taslak bulunamadı');

    // WP yapılandırılmamışsa getWpConfig dostça 400 fırlatır — handleApiError yakalar
    const config = await getWpConfig();

    // Kategori adını connector /categories ile id'ye çevir (eşleşme yoksa kategoriyi atla)
    let categories: number[] | undefined;
    if (draft.category) {
      const wpCategories = await wpFetch<WpCategory[]>(config, '/categories');
      const wanted = draft.category.trim().toLocaleLowerCase('tr-TR');
      const match = wpCategories.find((c) => c.name.trim().toLocaleLowerCase('tr-TR') === wanted);
      if (match) categories = [match.id];
    }

    const created = await wpFetch<WpCreatedPost>(config, '/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: draft.title || draft.topic,
        content: draft.body || '',
        status: 'publish',
        excerpt: draft.metaDescription || undefined,
        tags: parseTags(draft.tags),
        ...(categories ? { categories } : {}),
      }),
    });

    const updated = await prisma.aiDraft.update({
      where: { id: draft.id },
      data: {
        status: 'published',
        wpId: created.id,
        reviewerId: session?.sub ?? null,
        reviewerName: session?.name ?? null,
      },
    });

    return NextResponse.json({ ok: true, wpId: created.id, draft: updated });
  } catch (error) {
    return handleApiError(error, 'Taslak yayınlanamadı');
  }
}
