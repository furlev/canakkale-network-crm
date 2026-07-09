import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { clientIp } from '@/lib/net';
import { notify } from '@/lib/notify';
import { aiEnabled, classifyComment } from '@/lib/ai';

/**
 * Halka açık okuyucu yorumu (W1-D). Proxy'de /api/site/* public + IP rate-limitli.
 * /api/site/tip + /api/site/contact savunma desenini izler:
 *  - honeypot ("website") doluysa sahte başarı döner (botu bilgilendirmeyiz)
 *  - aynı IP'den saatte en fazla 5 yorum (module-level Map)
 *  - gövde boyutu üst sınırı (parse'tan önce, bellek DoS'a karşı)
 *
 * Yorum HER ZAMAN status='pending' olarak kaydedilir; otomatik yayınlanmaz.
 * classifyComment (ucuz model) toksisite/spam ön-skoru üretir → aiScore. AI
 * yapılandırılmadıysa ya da hata/timeout olursa aiScore=null; yorum yine pending.
 */

const MAX_BODY_BYTES = 16 * 1024;

const commentSchema = z.object({
  articleId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(2, 'Ad en az 2 karakter olmalı').max(80),
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta gir').max(160).optional(),
  body: z.string().trim().min(3, 'Yorum en az 3 karakter olmalı').max(2000),
  website: z.string().max(200).optional(), // honeypot
});

// ── IP başına saatlik limit ──
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function allowIp(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 2000) {
    for (const [key, times] of hits) {
      if (times.every(t => now - t >= WINDOW_MS)) hits.delete(key);
    }
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

/** Ön-moderasyon skorunu kısa bir üst sınırla dener; yavaş/başarısız AI kullanıcıyı bekletmez. */
async function scoreComment(name: string, body: string): Promise<number | null> {
  try {
    if (!(await aiEnabled())) return null;
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 6000));
    const cls = await Promise.race([classifyComment(name, body), timeout]);
    return cls ? cls.score : null;
  } catch {
    return null; // AI hatası yorumu engellemez — moderatör kuyruğa düşer
  }
}

/**
 * GET ?articleId=... — bir haberin ONAYLANMIŞ yorumlarını listeler (halka açık okuma).
 * E-posta/IP gibi kişisel alanlar DÖNDÜRÜLMEZ; yalnızca ad + gövde + tarih.
 */
export async function GET(request: Request) {
  try {
    const articleId = new URL(request.url).searchParams.get('articleId')?.trim();
    if (!articleId) throw new ApiError(400, 'articleId gerekli.');

    const comments = await prisma.siteComment.findMany({
      where: { articleId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, name: true, body: true, createdAt: true },
    });

    return NextResponse.json({ items: comments });
  } catch (error) {
    return handleApiError(error, 'Yorumlar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_BYTES) throw new ApiError(413, 'Gönderilen veri çok büyük.');

    const body = await parseBody(request, commentSchema);

    // Honeypot dolu → bot. Sahte başarı döndür, kayıt açma.
    if (body.website && body.website.trim() !== '') {
      return NextResponse.json({ ok: true, message: 'Yorumun alındı, moderasyon sonrası yayınlanacak.' });
    }

    const ip = clientIp(request.headers);
    if (!allowIp(ip)) {
      throw new ApiError(429, 'Çok fazla yorum gönderdin. Lütfen daha sonra tekrar dene.');
    }

    // Yorum yalnızca yayında olan bir habere iliştirilebilir.
    const article = await prisma.siteArticle.findFirst({
      where: { id: body.articleId, status: 'published', deletedAt: null },
      select: { id: true, title: true },
    });
    if (!article) throw new ApiError(404, 'Haber bulunamadı.');

    // Ön-moderasyon skoru (kısa await; başarısızsa null → yorum yine pending).
    const aiScore = await scoreComment(body.name, body.body);

    await prisma.siteComment.create({
      data: {
        articleId: article.id,
        name: body.name,
        email: body.email ?? null,
        body: body.body,
        status: 'pending',
        aiScore,
        ip,
      },
    });

    await notify('comment', `Yeni yorum onay bekliyor: ${article.title}`, '/site-yonetimi/yorumlar');
    return NextResponse.json({ ok: true, message: 'Yorumun alındı, moderasyon sonrası yayınlanacak.' });
  } catch (error) {
    return handleApiError(error, 'Yorum gönderilemedi');
  }
}
