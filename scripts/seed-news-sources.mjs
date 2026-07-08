/**
 * WP AI haber kaynaklarını seed'ler + Google News feed'ini test eder.
 * Çalıştır: DATABASE_URL=<local> node scripts/seed-news-sources.mjs
 *
 * İDEMPOTENT: feedUrl'e göre upsert eder (varsa günceller, yoksa ekler). Admin'in
 * elle kapattığı kaynakların `enabled` durumuna DOKUNMAZ.
 * Not: prod'da resmi seed yolu POST /api/admin/seed-sources'tur; bu script yerel dev içindir.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// sourceType: official (valilik/belediye/kurum) | local (yerel gazete) | aggregator (Google News) | social
// trustScore 0-100: resmi kaynak yüksek, agregatör düşük. Ağırlıklı konu seçiminde kullanılır.
const SOURCES = [
  // ── Agregatör (baz emniyet ağı) ──
  { name: 'Google News Çanakkale (BAZ)', feedUrl: 'https://news.google.com/rss/search?q=%C3%87anakkale&hl=tr&gl=TR&ceid=TR:tr', type: 'google_news', sourceType: 'aggregator', trustScore: 45, district: null, needsUA: false, notes: 'Emniyet ağı/agregatör' },

  // ── Yerel gazeteler ──
  { name: 'Çanakkale Olay', feedUrl: 'https://www.canakkaleolay.com/rss', type: 'rss', sourceType: 'local', trustScore: 62, district: null, needsUA: false, notes: 'Yüksek hacim, saf yerel' },
  { name: 'Çanakkale İnternet Medya', feedUrl: 'https://www.canakkaleinternetmedya.com/rss.xml', type: 'rss', sourceType: 'local', trustScore: 62, district: null, needsUA: false, notes: 'Valilik/ÇOMÜ/Troya' },
  { name: 'Çanakkale Haber', feedUrl: 'https://www.canakkalehaber.com/rss', type: 'rss', sourceType: 'local', trustScore: 60, district: null, needsUA: true, notes: 'Kategorili; WAF (UA gerek)' },
  { name: 'Biganın Sesi', feedUrl: 'https://www.biganinsesi.com/rss', type: 'rss', sourceType: 'local', trustScore: 58, district: 'biga', needsUA: false, notes: 'Biga + güney ilçe' },
  { name: 'Kalem Gazetesi', feedUrl: 'https://www.canakkalekalem.com/rss', type: 'rss', sourceType: 'local', trustScore: 58, district: null, needsUA: true, notes: 'İlçe çeşitliliği; WAF (UA gerek)' },
  { name: "Çan'ın Sesi", feedUrl: 'https://www.caninsesi.com.tr/rss', type: 'rss', sourceType: 'local', trustScore: 56, district: 'can', needsUA: false, notes: 'Çan ilçesi' },

  // ── Resmi kaynaklar (yüksek güven; teyit ağırlığı) ──
  { name: 'Çanakkale Valiliği', feedUrl: 'https://www.canakkale.gov.tr/rss', type: 'rss', sourceType: 'official', trustScore: 92, district: null, needsUA: false, notes: 'Resmi — feed erişimi doğrulanmalı' },
  { name: 'Çanakkale Belediyesi', feedUrl: 'https://www.canakkale.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'merkez', needsUA: false, notes: 'Merkez belediye (resmi)' },
  { name: 'ÇOMÜ (Onsekiz Mart Üniv.)', feedUrl: 'https://www.comu.edu.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 80, district: 'merkez', needsUA: false, notes: 'Üniversite duyuruları (resmi)' },
  { name: 'AFAD (afet duyuruları)', feedUrl: 'https://www.afad.gov.tr/rss', type: 'rss', sourceType: 'official', trustScore: 90, district: null, needsUA: false, notes: 'Ulusal — yalnız Çanakkale ile ilgili olanlar yerel sayılır' },
  { name: 'Meteoroloji (MGM)', feedUrl: 'https://www.mgm.gov.tr/rss/', type: 'rss', sourceType: 'official', trustScore: 85, district: null, needsUA: false, notes: 'Hava/uyarı — feed erişimi doğrulanmalı' },

  // ── İlçe belediyeleri (resmi; feed erişimi doğrulanmalı, ingest hata-toleranslı) ──
  { name: 'Biga Belediyesi', feedUrl: 'https://www.biga.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'biga', needsUA: false, notes: 'İlçe belediye (resmi)' },
  { name: 'Çan Belediyesi', feedUrl: 'https://www.can.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'can', needsUA: false, notes: 'İlçe belediye (resmi)' },
  { name: 'Ezine Belediyesi', feedUrl: 'https://www.ezine.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'ezine', needsUA: false, notes: 'İlçe belediye (resmi)' },
  { name: 'Gelibolu Belediyesi', feedUrl: 'https://www.gelibolu.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'gelibolu', needsUA: false, notes: 'İlçe belediye (resmi)' },
  { name: 'Lapseki Belediyesi', feedUrl: 'https://www.lapseki.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'lapseki', needsUA: false, notes: 'İlçe belediye (resmi)' },
  { name: 'Ayvacık Belediyesi', feedUrl: 'https://www.ayvacik.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'ayvacik', needsUA: false, notes: 'İlçe belediye (resmi)' },
  { name: 'Bayramiç Belediyesi', feedUrl: 'https://www.bayramic.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'bayramic', needsUA: false, notes: 'İlçe belediye (resmi)' },
  { name: 'Eceabat Belediyesi', feedUrl: 'https://www.eceabat.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'eceabat', needsUA: false, notes: 'İlçe belediye (resmi)' },
  { name: 'Gökçeada Belediyesi', feedUrl: 'https://www.gokceada.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'gokceada', needsUA: false, notes: 'İlçe belediye (resmi)' },
  { name: 'Yenice Belediyesi', feedUrl: 'https://www.yenice.bel.tr/feed/', type: 'rss', sourceType: 'official', trustScore: 85, district: 'yenice', needsUA: false, notes: 'İlçe belediye (resmi)' },
];

// İlçe-bazlı Google News aramaları (agregatör) — ilçe kapsama açığını kapatır.
// slug'lar src/lib/districts.ts ile hizalı; merkez BAZ kaynağıyla zaten kapsanıyor.
const DISTRICT_QUERIES = [
  ['ayvacik', 'Ayvacık'], ['bayramic', 'Bayramiç'], ['biga', 'Biga'], ['can', 'Çan'],
  ['eceabat', 'Eceabat'], ['ezine', 'Ezine'], ['gelibolu', 'Gelibolu'], ['gokceada', 'Gökçeada'],
  ['lapseki', 'Lapseki'], ['yenice', 'Yenice'],
];
for (const [slug, name] of DISTRICT_QUERIES) {
  const q = encodeURIComponent(`${name} Çanakkale`);
  SOURCES.push({
    name: `Google News ${name}`,
    feedUrl: `https://news.google.com/rss/search?q=${q}&hl=tr&gl=TR&ceid=TR:tr`,
    type: 'google_news', sourceType: 'aggregator', trustScore: 45, district: slug, needsUA: false,
    notes: `İlçe-bazlı agregatör (${name})`,
  });
}

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
  // İdempotent upsert (feedUrl anahtar): admin'in kapattığı `enabled` durumuna dokunma.
  let created = 0, updated = 0;
  for (const s of SOURCES) {
    const existing = await prisma.newsSource.findFirst({ where: { feedUrl: s.feedUrl } });
    const data = {
      name: s.name, type: s.type, needsUA: !!s.needsUA,
      trustScore: s.trustScore, sourceType: s.sourceType, district: s.district ?? null, notes: s.notes ?? null,
    };
    if (existing) {
      await prisma.newsSource.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.newsSource.create({ data: { feedUrl: s.feedUrl, ...data } });
      created++;
    }
  }
  console.log(`Kaynaklar: ${created} eklendi, ${updated} güncellendi (idempotent, toplam ${SOURCES.length}).`);

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
  console.log(`\nToplam kaynak (DB): ${await prisma.newsSource.count()}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
