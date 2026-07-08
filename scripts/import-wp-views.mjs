/**
 * WP görüntülenme sayılarını (_mzb_post_view_count) SiteArticle.views alanına taşır.
 * Eşleme: post_id → SiteArticle.wpId (import-wp-news.mjs her makaleye wpId yazar).
 *
 * İki kaynak desteklenir:
 *   1) SQL dump:  DATABASE_URL=<db> node scripts/import-wp-views.mjs <dump.sql> [--dry-run]
 *   2) JSON dosyası (repoda hazır — prod/DO console için):
 *      DATABASE_URL zaten ortamda → node scripts/import-wp-views.mjs --json scripts/data/wp-views.json
 *
 * İdempotent: yalnızca kaynak değeri mevcut views'tan büyükse günceller.
 */
import fs from 'node:fs';
import readline from 'node:readline';
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonIdx = args.indexOf('--json');
const jsonPath = jsonIdx !== -1 ? args[jsonIdx + 1] : null;
const dumpPath = args.find(a => a.endsWith('.sql'));

if (!process.env.DATABASE_URL) {
  console.error('HATA: DATABASE_URL env değişkeni gerekli.');
  process.exit(1);
}
if (!jsonPath && (!dumpPath || !fs.existsSync(dumpPath))) {
  console.error('Kullanım: node scripts/import-wp-views.mjs <dump.sql> [--dry-run]');
  console.error('   veya : node scripts/import-wp-views.mjs --json scripts/data/wp-views.json [--dry-run]');
  process.exit(1);
}

const metaRe = /\(\s*\d+\s*,\s*(\d+)\s*,\s*'_mzb_post_view_count'\s*,\s*'(\d+)'\s*\)/g;

async function loadViews() {
  const viewByPostId = new Map();
  if (jsonPath) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    for (const [id, v] of Object.entries(data)) viewByPostId.set(Number(id), Number(v));
    return viewByPostId;
  }
  const rl = readline.createInterface({
    input: fs.createReadStream(dumpPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.includes('_mzb_post_view_count')) continue;
    for (const m of line.matchAll(metaRe)) viewByPostId.set(Number(m[1]), Number(m[2]));
  }
  return viewByPostId;
}

async function main() {
  const viewByPostId = await loadViews();
  console.log(`Kaynak okundu (${jsonPath ? 'json' : 'sql dump'}): ${viewByPostId.size} görüntülenme kaydı.`);

  const prisma = new PrismaClient();
  let updated = 0, skipped = 0, notFound = 0, total = 0;
  for (const [postId, views] of viewByPostId) {
    total += views;
    const article = await prisma.siteArticle.findUnique({
      where: { wpId: postId },
      select: { id: true, views: true },
    });
    if (!article) { notFound++; continue; }
    if (article.views >= views) { skipped++; continue; }
    if (!dryRun) {
      await prisma.siteArticle.update({ where: { id: article.id }, data: { views } });
    }
    updated++;
  }
  await prisma.$disconnect();
  console.log(`${dryRun ? '[DRY-RUN] ' : ''}Güncellenen: ${updated}, atlanan (views zaten ≥): ${skipped}, eşleşmeyen wpId: ${notFound}, kaynaktaki toplam görüntülenme: ${total.toLocaleString('tr-TR')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
