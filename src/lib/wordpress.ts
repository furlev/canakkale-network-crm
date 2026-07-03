import prisma from '@/lib/prisma';
import { ApiError } from '@/lib/api';

export type WpConfig = {
  url: string;
  endpoint: string;
  apiKey: string;
};

export type WpPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  status: string; // publish, draft, pending, ...
  date: string;
  modified: string;
  url: string;
  thumbnail: string | null;
  author: { id: number; name: string; avatar: string } | null;
  categories: { id: number; name: string; slug: string }[];
  views: number;
};

/** Read WordPress connection settings saved on the Ayarlar page. */
export async function getWpConfig(): Promise<WpConfig> {
  const row = await prisma.setting.findUnique({ where: { key: 'wordpress' } });
  if (!row) throw new ApiError(400, 'WordPress ayarları kayıtlı değil. Ayarlar → WordPress bölümünü doldurun.');

  let value: { url?: string; endpoint?: string; apiKey?: string };
  try {
    value = JSON.parse(row.value);
  } catch {
    throw new ApiError(500, 'WordPress ayarları okunamadı');
  }

  if (!value.url) throw new ApiError(400, 'WordPress URL ayarlanmamış');
  if (!value.apiKey) throw new ApiError(400, 'WordPress API anahtarı ayarlanmamış. WP yönetim panelindeki CRM Connector ayarlarından anahtarı alın.');

  return {
    url: value.url.replace(/\/+$/, ''),
    endpoint: (value.endpoint || '/wp-json/cn-crm/v1').replace(/\/+$/, ''),
    apiKey: value.apiKey,
  };
}

/** Call the cn-crm-connector plugin REST API. */
export async function wpFetch<T = unknown>(config: WpConfig, path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const url = `${config.url}${config.endpoint}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-CRM-API-Key': config.apiKey,
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'zaman aşımı' : 'bağlantı hatası';
    throw new ApiError(502, `WordPress sitesine ulaşılamadı (${reason}): ${config.url}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError(502, 'WordPress API anahtarı reddedildi. Anahtarı WP yönetim panelinden doğrulayın.');
  }
  if (res.status === 404) {
    throw new ApiError(502, 'CRM Connector eklentisi bulunamadı. Eklentinin WordPress\'te kurulu ve etkin olduğundan emin olun.');
  }
  if (!res.ok) {
    throw new ApiError(502, `WordPress hata döndürdü: HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

type WpPostList = {
  posts: WpPost[];
  total: number;
  pages: number;
  current_page: number;
};

const SYNC_MAX_PAGES = 4; // 4 × 50 = en fazla 200 yazı / senkron

/** WP'deki yazıları sayfa sayfa çekip News tablosuna upsert eder. */
export async function syncWpPosts(config: WpConfig): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  let page = 1;
  let totalPages = 1;

  do {
    const list = await wpFetch<WpPostList>(config, `/posts?status=any&per_page=50&page=${page}&orderby=date&order=DESC`);
    totalPages = Math.min(list.pages || 1, SYNC_MAX_PAGES);

    for (const post of list.posts || []) {
      const result = await upsertNewsFromWpPost(post);
      if (result === 'created') created++;
      else updated++;
    }
    page++;
  } while (page <= totalPages);

  return { created, updated };
}

/** Map a WP post onto News fields and upsert by wpId. Returns 'created' | 'updated'. */
export async function upsertNewsFromWpPost(post: WpPost): Promise<'created' | 'updated'> {
  const data = {
    title: post.title,
    category: post.categories?.[0]?.name || 'Genel',
    author: post.author?.name || 'Editör',
    status: post.status === 'publish' ? 'published' : 'draft',
    views: post.views || 0,
    publishDate: post.date ? new Date(post.date) : null,
    url: post.url || null,
  };

  const existing = await prisma.news.findUnique({ where: { wpId: post.id } });
  if (existing) {
    await prisma.news.update({ where: { wpId: post.id }, data });
    return 'updated';
  }
  await prisma.news.create({ data: { ...data, wpId: post.id } });
  return 'created';
}
