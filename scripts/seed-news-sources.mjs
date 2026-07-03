/**
 * WP AI haber kaynaklarını seed'ler + Google News feed'ini test eder.
 * Çalıştır: DATABASE_URL=<local> node scripts/seed-news-sources.mjs
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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

function clean(s) {
  if (!s) return '';
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
}
function tag(b, n) { const m = b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, 'i')); return m ? m[1] : undefined; }
function parseFeed(xml) {
  const out = [];
  for (const block of (xml.match(/<item[\s\S]*?<\/item>/gi) || [])) {
    const title = clean(tag(block, 'title'));
    const link = clean(tag(block, 'link'));
    if (title && link) out.push({ title, link });
  }
  return out;
}

async function main() {
  if ((await prisma.newsSource.count()) === 0) {
    for (const s of SOURCES) await prisma.newsSource.create({ data: s });
    console.log(`${SOURCES.length} kaynak eklendi.`);
  } else {
    console.log('Kaynaklar zaten mevcut, atlandı.');
  }

  // Google News feed'ini canlı test et
  console.log('\nGoogle News Çanakkale feed testi:');
  try {
    const res = await fetch(SOURCES[0].feedUrl, { headers: { Accept: 'application/rss+xml, application/xml, */*' } });
    const xml = await res.text();
    const items = parseFeed(xml);
    console.log(`  ${items.length} öğe çekildi. İlk 5 başlık:`);
    items.slice(0, 5).forEach((i, n) => console.log(`  ${n + 1}. ${i.title.slice(0, 90)}`));
  } catch (e) {
    console.log('  HATA:', e.message);
  }
  console.log(`\nToplam kaynak: ${await prisma.newsSource.count()}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
