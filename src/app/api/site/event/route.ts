import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { clientIp } from '@/lib/net';

/**
 * First-party site analitiği (halka açık; proxy'de `/api/site/` altında IP hız-sınırlı).
 * ViewBeacon buradan 'read_complete' ve 'outbound_click' olaylarını `navigator.sendBeacon`
 * ile atar. ('view' olayı ayrıca /api/site/view içinde, görüntülenme sayacı artışıyla
 * birlikte yazılır — çift ağ isteği olmasın diye.)
 *
 * KVKK: ham IP saklanmaz. `sessionHash = SHA-256(ip|ua|gün|pepper)` → geri
 * döndürülemeyen, kişiye bağlanamayan GÜNLÜK anonim kova (kaba tekil sayım için).
 *
 * Savunma:
 *  - gövde boyutu üst sınırı (parse'tan önce)
 *  - `type` allowlist + `slug` uzunluk sınırı (zod)
 *  - haber gerçekten yayında değilse sessizce ok:false (bot'un rastgele slug ile
 *    ArticleEvent şişirmesini engeller; sayaç kritik değil)
 *  - IP başına cömert dakikalık kova (analitik sık olay üretir)
 */

const MAX_BODY_BYTES = 4 * 1024;

const EVENT_TYPES = ['view', 'read_complete', 'share', 'outbound_click'] as const;

const eventSchema = z.object({
  slug: z.string().trim().min(1).max(160),
  type: z.enum(EVENT_TYPES),
  // 'view'/'share': ziyaretçinin geldiği dış host; 'outbound_click': gidilen dış host.
  referrerHost: z.string().trim().max(160).optional(),
});

// ── IP başına dakikalık kova (proxy'nin üstüne ikinci savunma hattı) ──
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 180;
const hits = new Map<string, number[]>();
function allowIp(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, t] of hits) if (t.every(x => now - x >= WINDOW_MS)) hits.delete(k);
  }
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

/** Kaba cihaz sınıfı (User-Agent). Kişisel veri değil — segmentasyon içindir. */
function deviceType(ua: string): 'mobile' | 'tablet' | 'desktop' {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|kindle|(android(?!.*mobi))/.test(s)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini|windows phone/.test(s)) return 'mobile';
  return 'desktop';
}

/** KVKK-dostu anonim günlük oturum kovası (ham IP saklanmaz). */
function sessionHash(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256')
    .update(`${ip}|${ua}|${day}|${process.env.AUTH_SECRET || 'cn'}`)
    .digest('hex')
    .slice(0, 40);
}

/** Sadece hostname'i tut (şema/port/yol sıyrılır); site içi/boş ise null (kaynak = doğrudan). */
function cleanHost(input: string | undefined, selfHost: string): string | null {
  if (!input) return null;
  let h = input.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(h)) h = new URL(h).hostname;
  } catch {
    /* düz host olarak devam */
  }
  h = h.replace(/^www\./, '').slice(0, 120);
  const self = selfHost.replace(/^www\./, '').split(':')[0];
  if (!h || h === self) return null;
  return /^[a-z0-9.-]+$/.test(h) ? h : null;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_BYTES) throw new ApiError(413, 'Gönderilen veri çok büyük.');

    const body = await parseBody(request, eventSchema);

    const ip = clientIp(request.headers);
    if (!allowIp(ip)) {
      // Analitik kritik değil — 429 yerine sessiz ok:false (istemciyi kırma)
      return NextResponse.json({ ok: false });
    }

    // Haber gerçekten var ve yayında mı? (rastgele slug ile veri şişirmeyi engeller)
    const article = await prisma.siteArticle.findFirst({
      where: { slug: body.slug, status: 'published', deletedAt: null },
      select: { id: true, district: true },
    });
    if (!article) return NextResponse.json({ ok: false });

    const ua = request.headers.get('user-agent') || '';
    const selfHost = (request.headers.get('host') || 'canakkale.network').toLowerCase();

    await prisma.articleEvent.create({
      data: {
        articleId: article.id,
        slug: body.slug,
        type: body.type,
        referrerHost: cleanHost(body.referrerHost, selfHost),
        deviceType: deviceType(ua),
        district: article.district, // haberden denormalize (istemciye güvenilmez)
        sessionHash: sessionHash(ip, ua),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Boyut/doğrulama hataları düzgün statüyle döner; beklenmeyen (DB) hatalarda
    // analitik istemciyi kırmasın diye sessizce ok:false.
    if (error instanceof ApiError) return handleApiError(error, 'Olay kaydedilemedi');
    return NextResponse.json({ ok: false });
  }
}
