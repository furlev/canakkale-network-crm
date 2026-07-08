import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { storeDataUri } from '@/lib/storage';
import { stripHtml } from '@/lib/site';
import { districtName } from '@/lib/districts';

/**
 * Taslaktan Instagram içeriği hazırlar (GET) ve üretilen görselleri kaydeder (POST).
 * Görselin RENDER'ı istemcide (html2canvas) yapılır — bu rota yalnız VERİ + ŞABLON döndürür.
 * Yalnız B/A.
 */

// ── Marka şablonu (Setting key: 'igTemplate') ──
export type IgTemplate = {
  brandName: string;
  handle: string;
  website: string;
  logo: string; // /public altında yol (data-URI güvenli, aynı köken)
  colors: { navy: string; red: string; redBright: string; gold: string; paper: string; ink: string };
  slideCharLimit: number; // carousel slayt başına hedef karakter
  hashtags: string[]; // caption'a eklenecek varsayılan etiketler
};

const DEFAULT_IG_TEMPLATE: IgTemplate = {
  brandName: 'Çanakkale Network',
  handle: '@canakkale.network',
  website: 'canakkale.network',
  logo: '/site/logo-dark.png',
  colors: {
    navy: '#16263f',
    red: '#c8202f',
    redBright: '#e23140',
    gold: '#b98a2f',
    paper: '#f3eee4',
    ink: '#eef2f8',
  },
  slideCharLimit: 320,
  hashtags: ['#Çanakkale', '#ÇanakkaleNetwork', '#SonDakika', '#Haber'],
};

async function getIgTemplate(): Promise<IgTemplate> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'igTemplate' } });
    if (!row) return DEFAULT_IG_TEMPLATE;
    const parsed = JSON.parse(row.value);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_IG_TEMPLATE;
    return {
      ...DEFAULT_IG_TEMPLATE,
      ...parsed,
      colors: { ...DEFAULT_IG_TEMPLATE.colors, ...(parsed.colors || {}) },
      hashtags: Array.isArray(parsed.hashtags) && parsed.hashtags.length > 0 ? parsed.hashtags : DEFAULT_IG_TEMPLATE.hashtags,
    };
  } catch {
    return DEFAULT_IG_TEMPLATE;
  }
}

/** JSON string diziyi güvenle çöz. */
function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Etiketi Instagram hashtag'ine çevirir: boşlukları at, harf/rakamı koru (# ekle). */
function toHashtag(tag: string): string {
  const cleaned = tag.replace(/^#/, '').replace(/[^\p{L}\p{N}]+/gu, '');
  return cleaned ? `#${cleaned}` : '';
}

/** Gövdeyi 2-4 carousel slaytına böler (cümle sınırında, slideCharLimit hedefiyle). */
function splitBody(body: string | null, charLimit: number): string[] {
  if (!body) return [];
  const text = stripHtml(body, 100000);
  if (!text) return [];

  const sentences = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  const slides: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && (current.length + sentence.length + 1) > charLimit) {
      slides.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
    if (slides.length >= 4) break; // en fazla 4 slayt
  }
  if (current && slides.length < 4) slides.push(current);
  // 4'ü aştıysa kalanı son slayta iliştir (kırpma)
  return slides.slice(0, 4);
}

/** Caption: sosyal metin (yoksa özet/başlık) + hashtag'ler. */
function buildCaption(
  draft: { title: string | null; topic: string; socialPost: string | null; metaDescription: string | null; tags: string | null },
  template: IgTemplate,
): { text: string; hashtags: string[] } {
  const lead = (draft.socialPost || draft.metaDescription || draft.title || draft.topic || '').trim();

  const fromTags = parseTags(draft.tags).map(toHashtag).filter(Boolean);
  const seen = new Set<string>();
  const hashtags: string[] = [];
  for (const h of [...fromTags, ...template.hashtags]) {
    const key = h.toLocaleLowerCase('tr-TR');
    if (h && !seen.has(key)) {
      seen.add(key);
      hashtags.push(h);
    }
  }
  const limited = hashtags.slice(0, 12);
  const text = `${lead}\n\n${limited.join(' ')}`.trim();
  return { text, hashtags: limited };
}

/**
 * Kapak görselini istemcide html2canvas'ın taintlemeyeceği biçime getirir:
 * data-URI ise aynen; http(s) ise sunucuda çekip data-URI'ye çevirir (best-effort, aynı köken servis).
 */
async function toInlineImage(imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:')) return imageUrl;
  if (!/^https?:\/\//i.test(imageUrl)) return null;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!res.ok) return imageUrl;
    const type = res.headers.get('content-type') || 'image/jpeg';
    if (!type.startsWith('image/')) return imageUrl;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 10 * 1024 * 1024) return imageUrl; // 10MB üstü: URL'e düş
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return imageUrl; // çekilemezse URL'i döndür (istemci crossorigin dener)
  }
}

/** GET — IG içeriğini + şablonu hazırlar. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const { id } = await context.params;
    const draft = await prisma.aiDraft.findUnique({ where: { id } });
    if (!draft) throw new ApiError(404, 'Taslak bulunamadı');

    const template = await getIgTemplate();
    const [coverImage] = await Promise.all([toInlineImage(draft.imageUrl)]);
    const slides = splitBody(draft.body, template.slideCharLimit);
    const caption = buildCaption(draft, template);

    return NextResponse.json({
      draftId: draft.id,
      cover: {
        title: draft.title || draft.topic,
        category: draft.category,
        district: draft.district,
        districtName: districtName(draft.district),
        newsType: draft.newsType,
        imageUrl: coverImage,
        imageIsAi: !!draft.imageUrl && draft.imageUrl.startsWith('data:'),
      },
      slides,
      caption: caption.text,
      hashtags: caption.hashtags,
      template,
    });
  } catch (error) {
    return handleApiError(error, 'Instagram içeriği hazırlanamadı');
  }
}

// ── POST: üretilen PNG'leri kaydet ──
const postSchema = z.object({
  assets: z
    .array(
      z.object({
        kind: z.enum(['cover', 'slide', 'story']),
        index: z.coerce.number().int().min(0).max(20).optional(),
        dataUri: z
          .string()
          .min(1)
          .refine((v) => v.startsWith('data:image/'), { message: 'Yalnız görsel data-URI kabul edilir' }),
      }),
    )
    .min(1, 'Kaydedilecek görsel yok')
    .max(10),
});

/** POST — istemcide üretilen görselleri object storage'a (yoksa data-URI fallback) yazar; igAssets'e referans işler. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');

    const { id } = await context.params;
    const draft = await prisma.aiDraft.findUnique({ where: { id }, select: { id: true, title: true, topic: true } });
    if (!draft) throw new ApiError(404, 'Taslak bulunamadı');

    const { assets } = await parseBody(request, postSchema);

    const items: { kind: string; index: number; url: string }[] = [];
    for (const asset of assets) {
      const stored = await storeDataUri(asset.dataUri, `ig/${id}`);
      if (stored) items.push({ kind: asset.kind, index: asset.index ?? 0, url: stored });
    }

    const igAssets = { generatedAt: new Date().toISOString(), items };
    await prisma.aiDraft.update({ where: { id }, data: { igAssets: JSON.stringify(igAssets) } });

    await audit(session, 'updated', 'aiDraft', id, `Instagram görselleri üretildi (${items.length} adet): ${draft.title || draft.topic}`);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return handleApiError(error, 'Instagram görselleri kaydedilemedi');
  }
}
