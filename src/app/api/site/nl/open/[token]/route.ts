import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Bülten açılma pikseli (halka açık). Her bültenin gövdesine gömülü 1x1 saydam GIF
 * buraya istek atar: `/api/site/nl/open/<token>`. Eşleşen NewsletterRecipient'in
 * openedAt'i (yalnız ilk kez) damgalanır.
 *
 * İlke: GÖRSEL DÖNÜŞÜ ASLA BLOKLANMAZ — kayıt düşse bile piksel her zaman döner
 * (e-posta istemcisinde kırık görsel çıkmaz). Sonuç no-store (ara bellekler
 * açılmaları yutmasın).
 */

// 1x1 saydam GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

function pixelResponse(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'content-type': 'image/gif',
      'content-length': String(PIXEL.length),
      'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      pragma: 'no-cache',
      expires: '0',
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (token) {
      // Sadece ilk açılışı damgala (idempotent). Kayıt yoksa/hata olursa sessiz geç.
      await prisma.newsletterRecipient
        .updateMany({ where: { token, openedAt: null }, data: { openedAt: new Date() } })
        .catch(() => {});
    }
  } catch {
    /* takip kritik değil — piksel yine döner */
  }
  return pixelResponse();
}
