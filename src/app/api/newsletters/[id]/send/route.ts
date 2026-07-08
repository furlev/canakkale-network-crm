import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError, requireLevel } from '@/lib/api';
import { getTransport } from '@/lib/mailer';
import { notify } from '@/lib/notify';
import { audit } from '@/lib/audit';

export const maxDuration = 300;

/**
 * Bülten gönderimi — PER-SUBSCRIBER + açılma/tık takibi + segment.
 *
 *  - Yalnız ONAYLI abonelere gider: status='active' VE confirmedAt dolu (çift-onay).
 *  - İsteğe bağlı segment: body.tags verilirse yalnız o etiketlerden en az birine
 *    sahip aboneler hedeflenir (ilçe/kategori).
 *  - Her aboneye bir NewsletterRecipient (benzersiz token) yazılır; gövdeye o token'lı
 *    1x1 açılma pikseli gömülür ve site-içi bağlantılar tık sarmalayıcıdan geçirilir.
 *  - Her aboneye tek tek, throttle'lı (küçük batch + gecikme) gönderilir — SMTP'yi
 *    boğmadan. Gönderilemeyen aboneye ait recipient satırı silinir (istatistik temiz).
 *  - İNSAN ONAYI: bu uç yalnız editör (B) tıklamasıyla çalışır; otomatik cron yoktur.
 */

const sendSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(48)).max(20).optional(),
});

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

function publicBaseUrl(): string {
  const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://canakkale.network';
  return raw.replace(/\/+$/, '');
}

function siteHosts(): Set<string> {
  const set = new Set(
    (process.env.SITE_HOSTS || 'canakkale.network,www.canakkale.network')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean),
  );
  if (process.env.NODE_ENV !== 'production') {
    set.add('127.0.0.1:3000');
    set.add('127.0.0.1:3001');
    set.add('localhost:3000');
  }
  return set;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
const TRAIL_RE = /[.,;:!?)]+$/;

/**
 * Düz metni paragraflara böler, URL'leri linke çevirir; site-içi bağlantıları
 * tık sarmalayıcıdan geçirir (takip). Site-dışı bağlantılar doğrudan gider (takipsiz).
 */
function renderContent(content: string, base: string, token: string): string {
  const hosts = siteHosts();
  const linkify = (text: string): string => {
    let out = '';
    let last = 0;
    for (const m of text.matchAll(URL_RE)) {
      const start = m.index ?? 0;
      out += escHtml(text.slice(last, start));
      let url = m[0];
      let trail = '';
      const t = url.match(TRAIL_RE);
      if (t) { trail = t[0]; url = url.slice(0, -trail.length); }
      let href = url;
      try {
        const u = new URL(url);
        if (hosts.has(u.host.toLowerCase())) {
          href = `${base}/api/site/nl/click/${encodeURIComponent(token)}?u=${encodeURIComponent(url)}`;
        }
      } catch { /* geçersiz URL → düz metin gibi link */ }
      out += `<a href="${escAttr(href)}" style="color:#c8202f;text-decoration:underline;">${escHtml(url)}</a>${escHtml(trail)}`;
      last = start + m[0].length;
    }
    out += escHtml(text.slice(last));
    return out;
  };

  return content
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px;line-height:1.6;color:#16263f;">${linkify(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function buildHtml(
  subject: string,
  intro: string | null,
  content: string,
  opts: { base: string; token: string; unsubUrl: string },
): string {
  const body = renderContent(content, opts.base, opts.token);
  const pixel = `<img src="${escAttr(opts.base)}/api/site/nl/open/${encodeURIComponent(opts.token)}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`;
  return `<!DOCTYPE html><html lang="tr"><body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:#16263f;padding:22px 28px;"><span style="color:#fff;font-size:20px;font-weight:800;">Çanakkale <span style="color:#c8202f;">Network</span></span></div>
    <div style="padding:28px;">
      <h1 style="font-size:22px;color:#16263f;margin:0 0 16px;">${escHtml(subject)}</h1>
      ${intro ? `<p style="font-size:15px;color:#44536d;line-height:1.6;margin:0 0 18px;font-style:italic;">${escHtml(intro)}</p>` : ''}
      ${body}
    </div>
    <div style="padding:18px 28px;background:#efece4;font-size:12px;color:#8b96a8;line-height:1.6;">
      Bu e-postayı Çanakkale Network bültenine abone olduğunuz için aldınız.<br>
      Aboneliği bırakmak için <a href="${escAttr(opts.unsubUrl)}" style="color:#8b96a8;">tıklayın</a>.
    </div>
  </div>
  ${pixel}
  </body></html>`;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Abonenin tags JSON'ı, verilen segment etiketlerinden en az biriyle kesişiyor mu? */
function matchesSegment(tagsJson: string | null, segment: string[]): boolean {
  if (segment.length === 0) return true; // segment yok = tüm onaylı aboneler
  if (!tagsJson) return false;
  try {
    const arr = JSON.parse(tagsJson);
    if (!Array.isArray(arr)) return false;
    const set = new Set(arr.map((x: unknown) => String(x)));
    return segment.some(t => set.has(t));
  } catch {
    return false;
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const { tags } = await parseBody(request, sendSchema);
    const segment = tags ?? [];
    const params = await context.params;

    const newsletter = await prisma.newsletter.findUnique({ where: { id: params.id } });
    if (!newsletter) throw new ApiError(404, 'Bülten bulunamadı');
    if (newsletter.status === 'sent') throw new ApiError(400, 'Bu bülten zaten gönderildi');

    // Yalnız onaylı aboneler (çift-onay): active + confirmedAt dolu.
    const confirmed = await prisma.subscriber.findMany({
      where: { status: 'active', confirmedAt: { not: null } },
      select: { id: true, email: true, tags: true, unsubToken: true },
    });
    const audience = confirmed.filter(s => matchesSegment(s.tags, segment));
    if (audience.length === 0) {
      throw new ApiError(400, segment.length
        ? 'Bu segmentte onaylı abone yok'
        : 'Onaylı abone yok (çift-onay tamamlanmış abone gerekli)');
    }

    const { transport, from } = await getTransport();
    const base = publicBaseUrl();

    let sent = 0;
    const errors: string[] = [];
    const batchSize = 5;

    for (let i = 0; i < audience.length; i += batchSize) {
      const batch = audience.slice(i, i + batchSize);
      await Promise.all(batch.map(async (sub) => {
        // unsubToken garanti (eski onaylı abonede eksik olabilir)
        let unsubToken = sub.unsubToken;
        if (!unsubToken) {
          unsubToken = newToken();
          await prisma.subscriber.update({ where: { id: sub.id }, data: { unsubToken } }).catch(() => {});
        }
        const token = newToken();
        // Önce takip satırı (piksel/tık bu token'a bağlanır), sonra gönderim.
        let recipientId: string | null = null;
        try {
          const rec = await prisma.newsletterRecipient.create({
            data: { newsletterId: newsletter.id, subscriberId: sub.id, token },
            select: { id: true },
          });
          recipientId = rec.id;
          const unsubUrl = `${base}/api/site/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
          const html = buildHtml(newsletter.subject, newsletter.intro, newsletter.content, { base, token, unsubUrl });
          await transport.sendMail({
            from: `Çanakkale Network <${from}>`,
            to: sub.email,
            subject: newsletter.subject,
            html,
            headers: {
              'List-Unsubscribe': `<${unsubUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          });
          sent++;
        } catch (e) {
          // Gönderilemedi → orphan recipient satırını temizle (istatistik doğru kalsın).
          if (recipientId) {
            await prisma.newsletterRecipient.delete({ where: { id: recipientId } }).catch(() => {});
          }
          if (errors.length < 10) errors.push(`${sub.email}: ${e instanceof Error ? e.message : 'gönderim hatası'}`);
        }
      }));
      if (i + batchSize < audience.length) await sleep(300); // throttle
    }

    const updated = await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: { status: 'sent', recipients: sent, sentAt: new Date() },
    });

    await audit(session, 'sent', 'newsletter', newsletter.id,
      `Bülten gönderildi: "${newsletter.subject}" — ${sent}/${audience.length} alıcı${segment.length ? ` (segment: ${segment.join(', ')})` : ''}`);
    await notify('info', `Bülten gönderildi: ${newsletter.subject} (${sent} alıcı)`, '/newsletters');

    return NextResponse.json({
      ok: true,
      sent,
      audience: audience.length,
      failed: audience.length - sent,
      errors: errors.length ? errors : undefined,
      newsletter: updated,
    });
  } catch (error) {
    return handleApiError(error, 'Bülten gönderilemedi');
  }
}
