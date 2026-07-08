/**
 * WordPress → yeni haber sitesi (SiteArticle/SiteCategory/SitePage) içerik göçü.
 *
 * canakkale.network'teki mevcut ~164 haberi ve statik sayfaları WP REST API
 * (wp-json/wp/v2) üzerinden çekip Prisma ile yeni site tablolarına aktarır.
 * İDEMPOTENT: tekrar çalıştırılabilir (haberler wpId, sayfa/kategoriler slug ile upsert).
 *
 * Kullanım:
 *   DATABASE_URL=<hedef-db> node scripts/import-wp-news.mjs [--dry-run]
 *
 *   --dry-run : DB'ye YAZMADAN yalnızca çekilen içeriği raporlar.
 *
 * Notlar:
 *   - Görüntülenme sayıları: WP REST'te standart bir views ucu yok; views=0 bırakılır
 *     ve rapor sonunda göç-sonrası SQL notu yazdırılır.
 *   - AI taslak akışına dokunmaz; içerikler newsType 'manual', status 'published' gelir.
 */
import { PrismaClient } from '@prisma/client';

const WP_BASE = process.env.WP_BASE_URL || 'https://canakkale.network';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const DRY_RUN = process.argv.includes('--dry-run');
const REQUEST_DELAY_MS = 300; // WAF/rate-limit nezaketi

if (!process.env.DATABASE_URL) {
  console.error('HATA: DATABASE_URL ortam değişkeni tanımlı değil.');
  console.error('Örnek: DATABASE_URL="postgresql://kullanici:sifre@host:5432/db" node scripts/import-wp-news.mjs');
  console.error('(Değeri asla dosyaya/commit\'e yazmayın; yalnızca komut satırında/ortamda kullanın.)');
  process.exit(1);
}

const prisma = new PrismaClient();

// ── src/lib/site.ts DEFAULT_CATEGORIES kopyası (lib .ts olduğundan .mjs'ten import edilemez) ──
const DEFAULT_CATEGORIES = [
  { slug: 'son-dakika', name: 'Son Dakika', color: '#c8202f', order: 0 },
  { slug: 'editorun-secimleri', name: 'Editörün Seçimleri', color: '#b98a2f', order: 1 },
  { slug: 'roportajlar', name: 'Sokak Röportajları', color: '#2f7db9', order: 2 },
  { slug: 'universite-haberleri', name: 'Üniversite Haberleri', color: '#2fb96b', order: 3 },
  { slug: 'etkinlik-haberleri', name: 'Etkinlik Haberleri', color: '#8a5cd6', order: 4 },
  { slug: 'spor-haberleri', name: 'Spor Haberleri', color: '#e0742f', order: 5 },
  { slug: 'tarih-sanat', name: 'Tarih & Sanat', color: '#a3852f', order: 6 },
  { slug: 'genel', name: 'Genel', color: '#5c6b82', order: 7 },
];
const DEFAULT_CATEGORY_SLUGS = new Set(DEFAULT_CATEGORIES.map((c) => c.slug));

// İçe aktarılacak statik sayfa slug'ları (anasayfa/haberler gerçek sayfa değil — ATLANIR)
const PAGE_ALLOWLIST = new Set([
  'hakkimizda',
  'iletisim',
  'sozlesmeler',
  'cerez-politikasi',
  'gizlilik-ve-guvenlik-politikasi',
  'kisisel-verilerin-korunmasi-kanunu-kvkk',
  'site-kullanim-kosullari',
]);

// ── Metin yardımcıları (src/lib/site.ts stripHtml kopyası + entity decode) ──

/** HTML gövdeden düz metin özet çıkarır (site.ts stripHtml ile aynı mantık). */
function stripHtml(html, maxLen = 200) {
  const text = (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen).replace(/\s\S*$/, '') + '…' : text;
}

/** WP "rendered" başlıklardaki HTML entity'leri çözer (isimli + sayısal). */
function decodeEntities(s) {
  if (!s) return '';
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘',
    rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', trade: '™', copy: '©', reg: '®',
  };
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (_, n) => named[n] ?? `&${n};`)
    .trim();
}

/** Gutenberg blok yorumlarını (<!-- wp:... --> / <!-- /wp:... -->) temizler; script/iframe'lere DOKUNMAZ. */
function cleanWpComments(html) {
  return (html || '').replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '').trim();
}

/** İçerikteki ilk <img src="..."> değerini döndürür (featured media yoksa yedek kapak). */
function firstImgSrc(html) {
  const m = (html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastRequestAt = 0;
async function wpFetch(url) {
  // İstekler arası en az REQUEST_DELAY_MS bekle (WAF nezaketi)
  const wait = lastRequestAt + REQUEST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  return fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
}

// ── Rapor sayaçları ──
const report = {
  categoriesUpserted: 0,
  extraCategoriesCreated: [],
  articles: 0,
  articlesWithImage: 0,
  pages: 0,
  pagesSkipped: [],
  kunyeCreated: false,
  featuredSet: null,
  viewsImported: false,
  errors: [],
};

// ── 1) Kategoriler ──
async function importCategories() {
  console.log('── Kategoriler ──');
  for (const c of DEFAULT_CATEGORIES) {
    if (DRY_RUN) {
      console.log(`  [dry-run] upsert kategori: ${c.slug} (${c.name})`);
    } else {
      await prisma.siteCategory.upsert({
        where: { slug: c.slug },
        update: { name: c.name, color: c.color, order: c.order },
        create: { slug: c.slug, name: c.name, color: c.color, order: c.order, showInNav: true },
      });
    }
    report.categoriesUpserted++;
  }
  console.log(`  ${report.categoriesUpserted} varsayılan kategori upsert edildi.`);
}

/** WP kategorisini SiteCategory'ye eşler; DEFAULT sette yoksa nav dışı kategori olarak upsert eder. */
const knownExtraCategories = new Set();
async function resolveCategorySlug(wpCategory) {
  if (!wpCategory || !wpCategory.slug) return 'genel';
  const slug = wpCategory.slug === 'uncategorized' ? 'genel' : wpCategory.slug;
  if (DEFAULT_CATEGORY_SLUGS.has(slug)) return slug;
  if (!knownExtraCategories.has(slug)) {
    knownExtraCategories.add(slug);
    report.extraCategoriesCreated.push(slug);
    if (DRY_RUN) {
      console.log(`  [dry-run] WP kategorisi eklenecek (nav dışı): ${slug}`);
    } else {
      await prisma.siteCategory.upsert({
        where: { slug },
        update: { name: decodeEntities(wpCategory.name) || slug },
        create: { slug, name: decodeEntities(wpCategory.name) || slug, order: 99, showInNav: false },
      });
    }
  }
  return slug;
}

// ── 2) Haberler ──
async function importPosts() {
  console.log('\n── Haberler (wp/v2/posts) ──');
  let page = 1;
  let totalPages = 1;
  for (;;) {
    const url = `${WP_BASE}/wp-json/wp/v2/posts?per_page=100&page=${page}&_embed=1`;
    let res;
    try {
      res = await wpFetch(url);
    } catch (e) {
      report.errors.push(`posts sayfa ${page}: ${e.message}`);
      break;
    }
    if (res.status === 400) break; // sayfa aralığı bitti (rest_post_invalid_page_number)
    if (!res.ok) {
      report.errors.push(`posts sayfa ${page}: HTTP ${res.status}`);
      break;
    }
    totalPages = parseInt(res.headers.get('x-wp-totalpages') || String(totalPages), 10) || totalPages;
    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) break;
    console.log(`  Sayfa ${page}/${totalPages}: ${posts.length} haber`);

    for (const post of posts) {
      try {
        await importOnePost(post);
      } catch (e) {
        report.errors.push(`post ${post?.id} (${post?.slug || '?'}): ${e.message}`);
      }
    }
    if (page >= totalPages) break;
    page++;
  }
  console.log(`  Toplam ${report.articles} haber işlendi (${report.articlesWithImage} kapak görselli).`);
}

async function importOnePost(post) {
  const wpId = post.id;
  const title = decodeEntities(post.title?.rendered || '') || `(başlıksız #${wpId})`;
  const body = cleanWpComments(post.content?.rendered || '');
  const summary = stripHtml(post.excerpt?.rendered || '', 180) || null;

  // Slug: WP slug'ı aynen (yüzde-kodlu Türkçe slug'lar çözülür)
  let slug = post.slug || `haber-${wpId}`;
  try { slug = decodeURIComponent(slug); } catch { /* zaten çözülmüş */ }

  // Kategori: ilk WP kategorisi → DEFAULT sette varsa o, yoksa nav dışı upsert
  const embedded = post._embedded || {};
  const terms = Array.isArray(embedded['wp:term']) ? embedded['wp:term'].flat() : [];
  const categories = terms.filter((t) => t && t.taxonomy === 'category');
  const categorySlug = await resolveCategorySlug(categories[0]);
  const isEditorPick = categories.some((c) => c.slug === 'editorun-secimleri');

  // Kapak: featured media → yoksa içerikteki ilk <img>
  const media = Array.isArray(embedded['wp:featuredmedia']) ? embedded['wp:featuredmedia'][0] : null;
  const imageUrl = media?.source_url || firstImgSrc(body);
  const imageAlt = media?.alt_text || null;
  if (imageUrl) report.articlesWithImage++;

  const authorName = (Array.isArray(embedded.author) && embedded.author[0]?.name) || 'Çanakkale Network';
  const publishedAt = post.date_gmt ? new Date(`${post.date_gmt}Z`) : new Date();

  if (DRY_RUN) {
    console.log(`    [dry-run] #${wpId} "${title.slice(0, 60)}" → ${categorySlug}${imageUrl ? ' [görsel]' : ''}${isEditorPick ? ' [editör seçimi]' : ''}`);
    report.articles++;
    return;
  }

  // Slug çakışması: aynı slug'lı ama farklı kaynaklı makale varsa wpId son eki ekle
  const bySlug = await prisma.siteArticle.findUnique({ where: { slug }, select: { wpId: true } });
  if (bySlug && bySlug.wpId !== wpId) slug = `${slug}-${wpId}`;

  const data = {
    slug,
    title,
    summary,
    body,
    categorySlug,
    imageUrl,
    imageAlt,
    authorName,
    status: 'published',
    newsType: 'manual',
    isEditorPick,
    publishedAt,
    wpId,
    deletedAt: null,
  };
  await prisma.siteArticle.upsert({
    where: { wpId },
    update: data,
    create: data,
  });
  report.articles++;
}

// ── 3) Görüntülenme sayıları ──
async function checkViews() {
  console.log('\n── Görüntülenme sayıları ──');
  // Standart WP REST'te views ucu yok; yine de API'nin ayakta olduğunu doğrula.
  try {
    const res = await wpFetch(`${WP_BASE}/wp-json/wp/v2/posts?per_page=1`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log('  WP REST API çalışıyor; ancak views için standart bir uç yok.');
  } catch (e) {
    report.errors.push(`views kontrolü: ${e.message}`);
  }
  report.viewsImported = false;
  console.log('  Views alınamadı → tüm makaleler views=0 ile aktarıldı.');
  console.log('  Göç sonrası (istenirse) elle güncelleme örneği:');
  console.log('    UPDATE "SiteArticle" SET views = <sayı> WHERE "wpId" = <wp post id>;');
}

// ── 4) Sayfalar ──
async function importPages() {
  console.log('\n── Sayfalar (wp/v2/pages) ──');
  let res;
  try {
    res = await wpFetch(`${WP_BASE}/wp-json/wp/v2/pages?per_page=50`);
  } catch (e) {
    report.errors.push(`pages: ${e.message}`);
    return;
  }
  if (!res.ok) {
    report.errors.push(`pages: HTTP ${res.status}`);
    return;
  }
  const pages = await res.json();
  if (!Array.isArray(pages)) return;

  for (const p of pages) {
    let slug = p.slug || '';
    try { slug = decodeURIComponent(slug); } catch { /* zaten çözülmüş */ }
    if (!PAGE_ALLOWLIST.has(slug)) {
      report.pagesSkipped.push(slug || `#${p.id}`);
      continue;
    }
    const title = decodeEntities(p.title?.rendered || '') || slug;
    const content = cleanWpComments(p.content?.rendered || '');
    if (DRY_RUN) {
      console.log(`  [dry-run] upsert sayfa: ${slug} ("${title}")`);
    } else {
      await prisma.sitePage.upsert({
        where: { slug },
        update: { title, content, status: 'published' },
        create: { slug, title, content, status: 'published', updatedBy: 'wp-import' },
      });
    }
    report.pages++;
  }
  console.log(`  ${report.pages} sayfa aktarıldı; atlanan: ${report.pagesSkipped.join(', ') || '(yok)'}`);
}

// ── 5) Künye (yalnızca YOKSA oluştur — upsert değil, elle düzenleme korunur) ──
async function ensureKunye() {
  console.log('\n── Künye ──');
  const content = [
    '<h2>Künye</h2>',
    '<p><strong>Çanakkale Network</strong> — Şehrin Dijital Meydanı</p>',
    '<table>',
    '<tr><td><strong>İmtiyaz Sahibi</strong></td><td>Çanakkale Network</td></tr>',
    '<tr><td><strong>Sorumlu Yazı İşleri Müdürü</strong></td><td>—</td></tr>',
    '<tr><td><strong>Genel Yayın Yönetmeni</strong></td><td>—</td></tr>',
    '<tr><td><strong>İletişim</strong></td><td>info@canakkale.network</td></tr>',
    '<tr><td><strong>Webmaster</strong></td><td>webmaster@canakkale.network</td></tr>',
    '<tr><td><strong>Tekzip / Düzeltme</strong></td><td>tekzip@canakkale.network</td></tr>',
    '<tr><td><strong>Adres</strong></td><td>Çanakkale, Türkiye</td></tr>',
    '</table>',
    '<p><em>Bu sayfayı CRM &gt; Site Yönetimi &gt; Sayfalar bölümünden güncelleyebilirsiniz.</em></p>',
  ].join('\n');

  if (DRY_RUN) {
    console.log('  [dry-run] "kunye" sayfası yoksa varsayılan iskelet oluşturulacak.');
    return;
  }
  const existing = await prisma.sitePage.findUnique({ where: { slug: 'kunye' } });
  if (existing) {
    console.log('  "kunye" sayfası zaten var, dokunulmadı.');
    return;
  }
  await prisma.sitePage.create({
    data: { slug: 'kunye', title: 'Künye', content, status: 'published', updatedBy: 'wp-import' },
  });
  report.kunyeCreated = true;
  console.log('  Varsayılan künye iskeleti oluşturuldu (CRM > Site Yönetimi > Sayfalar\'dan düzenlenebilir).');
}

// ── 6) Öne çıkan (yalnızca hiç isFeatured yoksa) ──
async function ensureFeatured() {
  console.log('\n── Öne çıkan ──');
  if (DRY_RUN) {
    console.log('  [dry-run] Hiç isFeatured makale yoksa en yeni yayınlanmış makale manşet yapılacak.');
    return;
  }
  const featuredCount = await prisma.siteArticle.count({ where: { isFeatured: true, deletedAt: null } });
  if (featuredCount > 0) {
    console.log(`  Zaten ${featuredCount} manşet var, dokunulmadı.`);
    return;
  }
  const newest = await prisma.siteArticle.findFirst({
    where: { status: 'published', deletedAt: null },
    orderBy: { publishedAt: 'desc' },
  });
  if (!newest) {
    console.log('  Yayınlanmış makale yok, manşet atlandı.');
    return;
  }
  await prisma.siteArticle.update({ where: { id: newest.id }, data: { isFeatured: true } });
  report.featuredSet = newest.title;
  console.log(`  Manşet yapıldı: "${newest.title.slice(0, 70)}"`);
}

// ── Ana akış ──
async function main() {
  console.log(`WP içerik göçü başlıyor — kaynak: ${WP_BASE}${DRY_RUN ? '  [DRY-RUN: DB\'ye yazılmayacak]' : ''}\n`);

  // Ön kontrol: WP REST API erişilebilir mi?
  const probe = await wpFetch(`${WP_BASE}/wp-json/wp/v2/posts?per_page=1`);
  if (!probe.ok) {
    throw new Error(`WP REST API erişilemiyor: ${WP_BASE}/wp-json/wp/v2/posts → HTTP ${probe.status}`);
  }
  const totalPosts = probe.headers.get('x-wp-total');
  console.log(`WP REST API erişilebilir. Toplam haber (X-WP-Total): ${totalPosts ?? 'bilinmiyor'}\n`);

  await importCategories();
  await importPosts();
  await checkViews();
  await importPages();
  await ensureKunye();
  await ensureFeatured();

  // ── Özet rapor ──
  console.log('\n══════════ ÖZET ══════════');
  console.log(`  Kategoriler   : ${report.categoriesUpserted} varsayılan upsert` +
    (report.extraCategoriesCreated.length > 0 ? ` + WP'den ${report.extraCategoriesCreated.length} ek (nav dışı): ${report.extraCategoriesCreated.join(', ')}` : ''));
  console.log(`  Haberler      : ${report.articles} (${report.articlesWithImage} kapak görselli)`);
  console.log(`  Sayfalar      : ${report.pages} aktarıldı, ${report.pagesSkipped.length} atlandı`);
  console.log(`  Künye         : ${report.kunyeCreated ? 'oluşturuldu' : 'mevcut/atlandı'}`);
  console.log(`  Manşet        : ${report.featuredSet ? `"${report.featuredSet.slice(0, 60)}"` : 'değişmedi'}`);
  console.log(`  Views         : ${report.viewsImported ? 'aktarıldı' : 'aktarılamadı (0 bırakıldı — yukarıdaki SQL notuna bakın)'}`);
  if (report.errors.length > 0) {
    console.log(`  HATALAR (${report.errors.length}):`);
    for (const e of report.errors) console.log(`    - ${e}`);
  } else {
    console.log('  Hata yok.');
  }
  if (DRY_RUN) console.log('\n[DRY-RUN] Hiçbir veri yazılmadı. Gerçek göç için --dry-run olmadan çalıştırın.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('\nGÖÇ BAŞARISIZ:', e.message || e);
    await prisma.$disconnect();
    process.exit(1);
  });
