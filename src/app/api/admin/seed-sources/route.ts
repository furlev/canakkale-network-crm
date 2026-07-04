import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { safeEqual } from '@/lib/secure';

/** Varsayılan Çanakkale haber kaynakları (WP AI motoru girdisi). */
const SOURCES = [
  { name: 'Google News Çanakkale (BAZ)', feedUrl: 'https://news.google.com/rss/search?q=%C3%87anakkale&hl=tr&gl=TR&ceid=TR:tr', type: 'google_news', needsUA: false, notes: 'Emniyet ağı/agregatör' },
  { name: 'Çanakkale Olay', feedUrl: 'https://www.canakkaleolay.com/rss', type: 'rss', needsUA: false, notes: 'Yüksek hacim, saf yerel' },
  { name: 'Çanakkale İnternet Medya', feedUrl: 'https://www.canakkaleinternetmedya.com/rss.xml', type: 'rss', needsUA: false, notes: 'Valilik/ÇOMÜ/Troya' },
  { name: 'Çanakkale Haber', feedUrl: 'https://www.canakkalehaber.com/rss', type: 'rss', needsUA: true, notes: 'Kategorili; WAF (UA gerek)' },
  { name: 'Biganın Sesi', feedUrl: 'https://www.biganinsesi.com/rss', type: 'rss', needsUA: false, notes: 'Biga + güney ilçe' },
  { name: 'Kalem Gazetesi', feedUrl: 'https://www.canakkalekalem.com/rss', type: 'rss', needsUA: true, notes: 'İlçe çeşitliliği; WAF (UA gerek)' },
  { name: "Çan'ın Sesi", feedUrl: 'https://www.caninsesi.com.tr/rss', type: 'rss', needsUA: false, notes: 'Çan ilçesi (opsiyonel)' },
  { name: 'Çan Belediyesi (resmi)', feedUrl: 'https://www.can.bel.tr/feed/', type: 'rss', needsUA: false, notes: 'Resmi teyit kaynağı (opsiyonel)' },
];

/**
 * Haber kaynaklarını (idempotent) seed'ler. Eksik olanları feedUrl'e göre ekler.
 * Erişim: Bearer CRON_SECRET veya admin oturumu.
 */
export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    const cronOk = !!process.env.CRON_SECRET && safeEqual(auth, `Bearer ${process.env.CRON_SECRET}`);
    if (!cronOk && !isAdmin(await getSession())) throw new ApiError(403, 'Yetkisiz');

    const before = await prisma.newsSource.count();
    let added = 0;
    for (const s of SOURCES) {
      const exists = await prisma.newsSource.findFirst({ where: { feedUrl: s.feedUrl } });
      if (!exists) { await prisma.newsSource.create({ data: s }); added++; }
    }
    const total = await prisma.newsSource.count();
    return NextResponse.json({ ok: true, added, before, total });
  } catch (error) {
    return handleApiError(error, 'Kaynak seed başarısız');
  }
}
