import { NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { notify, nextNumber } from '@/lib/notify';

export const maxDuration = 60; // IMAP turu uzun sürebilir

const BATCH_LIMIT = 20; // tek seferde en fazla bu kadar mail işle

type EmailSettings = {
  tipEmail?: string;
  imapServer?: string;
  imapPort?: string;
  encryption?: string;
};

/**
 * ihbar@ posta kutusundaki okunmamış mailleri Tip kayıtlarına çevirir.
 * Erişim: oturum açmış kullanıcı (sayfadaki buton) VEYA `Authorization: Bearer <CRON_SECRET>`
 * (Render Cron Job / harici zamanlayıcı için).
 */
export async function POST(request: Request) {
  // Yetki kontrolü — middleware /api/cron/* yolunu pas geçer, rota kendini korur
  const session = await getSession();
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const cronOk = !!process.env.CRON_SECRET && bearer === process.env.CRON_SECRET;
  if (!session && !cronOk) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  // Ayarları oku
  const row = await prisma.setting.findUnique({ where: { key: 'email' } });
  let emailSettings: EmailSettings = {};
  try {
    emailSettings = row ? JSON.parse(row.value) : {};
  } catch { /* boş ayarlarla devam — aşağıda yakalanır */ }

  const host = emailSettings.imapServer;
  const user = emailSettings.tipEmail;
  const pass = process.env.IMAP_PASSWORD;

  if (!host || !user) {
    return NextResponse.json(
      { error: 'IMAP ayarları eksik. Ayarlar → E-posta bölümünü doldurun.' },
      { status: 400 }
    );
  }
  if (!pass) {
    return NextResponse.json(
      { error: 'IMAP_PASSWORD ortam değişkeni ayarlanmamış. Posta kutusu şifresini sunucu ortamına ekleyin.' },
      { status: 400 }
    );
  }

  const port = parseInt(emailSettings.imapPort || '993', 10) || 993;
  const client = new ImapFlow({
    host,
    port,
    secure: emailSettings.encryption !== 'STARTTLS', // 993/SSL varsayılan
    auth: { user, pass },
    logger: false,
  });

  let created = 0;
  const errors: string[] = [];

  try {
    await client.connect();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'bilinmeyen hata';
    return NextResponse.json(
      { error: `Posta sunucusuna bağlanılamadı (${host}:${port}): ${msg}` },
      { status: 502 }
    );
  }

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const unseen = await client.search({ seen: false });
      const batch = (unseen || []).slice(0, BATCH_LIMIT);

      for (const uid of batch) {
        try {
          const msg = await client.fetchOne(String(uid), { source: true });
          if (!msg || !msg.source) continue;

          const parsed = await simpleParser(msg.source);
          const fromAddr = parsed.from?.value?.[0];
          const subject = (parsed.subject || '(Konu yok)').slice(0, 250);
          const content = (parsed.text || parsed.html || '').toString().trim().slice(0, 5000) || '(Boş içerik)';
          const source = fromAddr
            ? `${fromAddr.name ? fromAddr.name + ' ' : ''}<${fromAddr.address}>`.trim()
            : 'Bilinmeyen gönderen';

          const [lastTip, count] = await Promise.all([
            prisma.tip.findFirst({ orderBy: { createdAt: 'desc' }, select: { tipNumber: true } }),
            prisma.tip.count(),
          ]);
          await prisma.tip.create({
            data: {
              tipNumber: nextNumber(lastTip?.tipNumber, 'TIP', 3, count),
              subject,
              content,
              source,
              sourceType: 'email',
              priority: 'normal',
              status: 'new',
            },
          });
          await notify('tip', `Yeni ihbar maili: ${subject}`, '/tips');
          created++;

          await client.messageFlagsAdd(String(uid), ['\\Seen']);
        } catch (error) {
          errors.push(`Mail #${uid}: ${error instanceof Error ? error.message : 'işlenemedi'}`);
        }
      }
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error('[cron/check-tips]', error);
    return NextResponse.json(
      { error: `Posta kutusu okunamadı: ${error instanceof Error ? error.message : 'bilinmeyen hata'}` },
      { status: 502 }
    );
  } finally {
    await client.logout().catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    created,
    errors: errors.length ? errors : undefined,
    message: created > 0
      ? `${created} yeni ihbar maili alındı`
      : 'Yeni mail yok',
  });
}
