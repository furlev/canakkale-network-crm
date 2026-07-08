import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Tek-tık abonelikten çıkma (halka açık; her bültenin altındaki bağlantı).
 * `?token=` unsubToken (benzersiz) ile eşleşen aboneyi bulur → status=unsubscribed.
 *
 *  - GET  : kullanıcı bağlantıya tıklayınca (insan-dostu onay sayfası döner).
 *  - POST : RFC 8058 "List-Unsubscribe=One-Click" uyumlu istemciler için (JSON).
 *
 * İdempotent: zaten çıkmış abonede de başarı gösterilir. Token yanlışsa nötr sayfa
 * (durum sızdırılmaz). Opt-out kalıcıdır (subscribe rotası reaktive etmez).
 */

async function unsubscribeByToken(token: string | null): Promise<boolean | null> {
  if (!token) return null;
  const subscriber = await prisma.subscriber.findUnique({
    where: { unsubToken: token },
    select: { id: true, status: true },
  });
  if (!subscriber) return null; // token bulunamadı
  if (subscriber.status !== 'unsubscribed') {
    await prisma.subscriber.update({ where: { id: subscriber.id }, data: { status: 'unsubscribed' } });
  }
  return true;
}

function page(title: string, message: string, ok: boolean): NextResponse {
  const accent = ok ? '#16263f' : '#c8202f';
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
  <title>${title} — Çanakkale Network</title></head>
  <body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;color:#16263f;">
    <div style="max-width:520px;margin:8vh auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(22,38,63,.12);">
      <div style="background:#16263f;padding:20px 28px;"><span style="color:#fff;font-size:19px;font-weight:800;">Çanakkale <span style="color:#c8202f;">Network</span></span></div>
      <div style="padding:34px 30px;text-align:center;">
        <div style="font-size:46px;line-height:1;margin-bottom:14px;">${ok ? '👋' : 'ℹ️'}</div>
        <h1 style="font-size:22px;margin:0 0 12px;color:${accent};">${title}</h1>
        <p style="font-size:15px;color:#44536d;line-height:1.6;margin:0 0 26px;">${message}</p>
        <a href="/" style="display:inline-block;background:#c8202f;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">Siteye Git</a>
      </div>
    </div>
  </body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  try {
    const result = await unsubscribeByToken(token);
    if (result === null) {
      return page('Bağlantı geçersiz', 'Abonelikten çıkış bağlantısı geçersiz ya da hatalı görünüyor.', false);
    }
    return page(
      'Aboneliğin iptal edildi',
      'Bülten aboneliğin sonlandırıldı — artık senden e-posta almayacağız. Fikrini değiştirirsen sitedeki formdan yeniden abone olabilirsin.',
      true,
    );
  } catch (error) {
    console.error('[site/unsubscribe] hata:', error);
    return page('Bir şeyler ters gitti', 'İşlem şu an tamamlanamadı. Lütfen biraz sonra tekrar dene.', false);
  }
}

/** RFC 8058 tek-tık (List-Unsubscribe-Post) — token query'de gelir. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  try {
    const result = await unsubscribeByToken(token);
    if (result === null) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[site/unsubscribe] POST hata:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
