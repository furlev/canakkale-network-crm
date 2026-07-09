import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError } from '@/lib/api';
import { getTransport } from '@/lib/mailer';
import { honeypotTriggered, submittedTooFast } from '@/lib/bot';
import { verifyTurnstile } from '@/lib/turnstile';
import { clientIp } from '@/lib/net';

/**
 * Bülten aboneliği — ÇİFT-ONAY (double opt-in) (halka açık; proxy'de public + IP rate-limitli).
 *
 * KVKK/gizlilik gözetimi:
 *  - Her durumda AYNI nötr mesaj döner (e-posta enumeration'ı engellenir; kayıtlı
 *    olup olmadığı dışarıdan anlaşılamaz).
 *  - Bilinçli abonelikten çıkmış (unsubscribed) kayıt, üçüncü kişinin isteğiyle
 *    SESSİZCE yeniden aktifleştirilMEZ — opt-out kalıcıdır.
 *  - Yeni/bekleyen kayıt `pending` yapılır, confirmToken üretilir ve mevcut SMTP ile
 *    bir ONAY e-postası gönderilir. Abone linke tıklayıp onaylayana kadar (confirmedAt)
 *    bültene DÜŞMEZ. Onay maili gönderilemese bile kayıt yazılır ve nötr mesaj döner
 *    (mail hatası kullanıcıya sızmaz; onay daha sonra tekrar istenebilir).
 */

const NEUTRAL_MESSAGE = 'Talebin alındı! Onay e-postasını kontrol et — kutuna düşen bağlantıyla aboneliğini tamamla. 💌';

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi gir'),
  // İsteğe bağlı ilgi etiketleri (segment): ilçe/kategori. Yalnız kısa, güvenli string'ler.
  tags: z.array(z.string().trim().min(1).max(48)).max(20).optional(),
  // Bot koruması (hepsi opsiyonel → eski istemciler kırılmaz):
  //  website: honeypot (gizli alan; insan boş bırakır)
  //  ts: form render epoch ms (zaman-tuzağı; çok hızlı gönderim reddedilir)
  //  turnstileToken: Cloudflare Turnstile token'ı (yalnız TURNSTILE_SECRET varsa doğrulanır)
  website: z.string().max(200).optional(),
  ts: z.coerce.number().optional(),
  turnstileToken: z.string().max(4096).optional(),
});

/** URL-güvenli rastgele token (çift-onay + tek-tık çıkış). */
function newToken(): string {
  return randomBytes(24).toString('base64url');
}

/** E-postalarda kullanılacak public site kök adresi (sondaki / temizlenir). */
function publicBaseUrl(): string {
  const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://canakkale.network';
  return raw.replace(/\/+$/, '');
}

function confirmEmailHtml(confirmUrl: string): string {
  return `<!DOCTYPE html><html lang="tr"><body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;">
    <div style="background:#16263f;padding:22px 28px;"><span style="color:#fff;font-size:20px;font-weight:800;">Çanakkale <span style="color:#c8202f;">Network</span></span></div>
    <div style="padding:30px 28px;">
      <h1 style="font-size:21px;color:#16263f;margin:0 0 14px;">Aboneliğini onayla</h1>
      <p style="font-size:15px;color:#44536d;line-height:1.6;margin:0 0 22px;">
        Çanakkale Network bültenine kayıt talebini aldık. Aboneliğini tamamlamak için aşağıdaki düğmeye tıkla.
        Bu isteği sen yapmadıysan bu e-postayı yok sayman yeterli — hiçbir işlem yapılmaz.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${confirmUrl}" style="display:inline-block;background:#c8202f;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:8px;">Aboneliğimi Onayla</a>
      </p>
      <p style="font-size:12px;color:#8b96a8;line-height:1.6;margin:0;word-break:break-all;">
        Düğme çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br>${confirmUrl}
      </p>
    </div>
    <div style="padding:18px 28px;background:#efece4;font-size:12px;color:#8b96a8;">
      Çanakkale Network — Şehrin Dijital Meydanı
    </div>
  </div></body></html>`;
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, subscribeSchema);

    // ── Bot koruması ──
    // (a) Honeypot: gizli alan doluysa → sessiz sahte başarı (botu bilgilendirme, kayıt açma).
    // (b) Zaman-tuzağı: 2sn altında gönderim → aynı sessiz sahte başarı (opsiyonel; ts yoksa atlanır).
    if (honeypotTriggered(body.website) || submittedTooFast(body.ts, 2000)) {
      return NextResponse.json({ ok: true, message: NEUTRAL_MESSAGE });
    }
    // (c) Turnstile: yalnız TURNSTILE_SECRET tanımlıysa doğrular; yoksa no-op (graceful).
    const turnstile = await verifyTurnstile(body.turnstileToken, clientIp(request.headers));
    if (!turnstile.ok) {
      return NextResponse.json(
        { ok: false, message: 'Doğrulama tamamlanamadı. Lütfen tekrar dene.' },
        { status: 400 },
      );
    }

    const tagsJson = body.tags && body.tags.length ? JSON.stringify(body.tags) : undefined;

    const existing = await prisma.subscriber.findUnique({
      where: { email: body.email },
      select: { status: true, confirmToken: true, unsubToken: true, confirmedAt: true },
    });

    // Opt-out kalıcı: unsubscribed kaydı reaktive etme, ama durumu dışarı sızdırma.
    if (existing?.status === 'unsubscribed') {
      return NextResponse.json({ ok: true, message: NEUTRAL_MESSAGE });
    }

    // Zaten onaylı (confirmedAt dolu) → tekrar onay maili gönderme (spam/sızıntı önlenir).
    if (existing?.confirmedAt) {
      // İlgi etiketleri güncellenebilir (segment), sessizce.
      if (tagsJson) {
        await prisma.subscriber.update({ where: { email: body.email }, data: { tags: tagsJson } }).catch(() => {});
      }
      return NextResponse.json({ ok: true, message: NEUTRAL_MESSAGE });
    }

    // Yeni / bekleyen / (eski onaysız aktif): pending tut, token'ları hazırla, onay maili gönder.
    const confirmToken = existing?.confirmToken || newToken();
    const unsubToken = existing?.unsubToken || newToken();

    await prisma.subscriber.upsert({
      where: { email: body.email },
      update: {
        status: 'pending',
        confirmToken,
        unsubToken,
        ...(tagsJson ? { tags: tagsJson } : {}),
      },
      create: {
        email: body.email,
        source: 'website',
        status: 'pending',
        confirmToken,
        unsubToken,
        ...(tagsJson ? { tags: tagsJson } : {}),
      },
    });

    // Onay e-postası — best-effort. SMTP eksik/hatalıysa kaydı bozma, nötr mesaj dön.
    try {
      const confirmUrl = `${publicBaseUrl()}/api/site/subscribe/confirm?token=${encodeURIComponent(confirmToken)}`;
      const { transport, from } = await getTransport();
      await transport.sendMail({
        from: `Çanakkale Network <${from}>`,
        to: body.email,
        subject: 'Aboneliğini onayla — Çanakkale Network',
        html: confirmEmailHtml(confirmUrl),
      });
    } catch (mailError) {
      console.error('[site/subscribe] onay maili gönderilemedi:', mailError);
    }

    return NextResponse.json({ ok: true, message: NEUTRAL_MESSAGE });
  } catch (error) {
    return handleApiError(error, 'Abonelik kaydedilemedi');
  }
}
