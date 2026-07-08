import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Çift-onay tamamlama (halka açık; e-postadaki bağlantıdan GET ile açılır).
 * `?token=` confirmToken ile eşleşen aboneyi bulur → confirmedAt + status=active,
 * confirmToken temizlenir (bağlantı tek kullanımlık olur), unsubToken garanti edilir.
 *
 * Gizlilik: token yanlış/kullanılmış olsa bile nötr, insan-dostu bir sayfa döner
 * (durum sızdırılmaz). Sonuç her zaman HTML sayfadır (kullanıcı tarayıcıda açar).
 */

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

function page(title: string, message: string, ok: boolean): NextResponse {
  const accent = ok ? '#1f9d55' : '#c8202f';
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
  <title>${title} — Çanakkale Network</title></head>
  <body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;color:#16263f;">
    <div style="max-width:520px;margin:8vh auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(22,38,63,.12);">
      <div style="background:#16263f;padding:20px 28px;"><span style="color:#fff;font-size:19px;font-weight:800;">Çanakkale <span style="color:#c8202f;">Network</span></span></div>
      <div style="padding:34px 30px;text-align:center;">
        <div style="font-size:46px;line-height:1;margin-bottom:14px;">${ok ? '✅' : 'ℹ️'}</div>
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
  if (!token) {
    return page('Bağlantı geçersiz', 'Onay bağlantısı eksik ya da hatalı görünüyor.', false);
  }

  try {
    const subscriber = await prisma.subscriber.findFirst({
      where: { confirmToken: token },
      select: { id: true, unsubToken: true },
    });

    if (!subscriber) {
      // Token bulunamadı: ya yanlış ya da zaten kullanılmış (onaylanmış). Nötr sayfa.
      return page(
        'Bağlantı kullanılmış olabilir',
        'Bu onay bağlantısı geçersiz ya da daha önce kullanılmış. Zaten abone olabilirsin — merak etme, şehrin gündemi kutuna düşmeye devam eder.',
        false,
      );
    }

    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        status: 'active',
        confirmedAt: new Date(),
        confirmToken: null,
        unsubToken: subscriber.unsubToken || newToken(),
      },
    });

    return page(
      'Aboneliğin onaylandı!',
      'Teşekkürler — artık Çanakkale Network bülteninin bir parçasısın. Şehrin öne çıkan haberleri her hafta kutuna düşecek. 🎉',
      true,
    );
  } catch (error) {
    console.error('[site/subscribe/confirm] onay hatası:', error);
    return page(
      'Bir şeyler ters gitti',
      'Onay şu an tamamlanamadı. Lütfen biraz sonra bağlantıyı tekrar dene.',
      false,
    );
  }
}
