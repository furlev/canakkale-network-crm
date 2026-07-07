/**
 * Google Drive OAuth hazırlığı (Depo modülü) — bağımlılıksız, yalnız Node yerleşikleri.
 *
 * KULLANIM:
 *   1) Google Cloud Console → APIs & Services → Credentials → "Create credentials"
 *      → OAuth client ID → Application type: **Desktop app**. (Drive API'yi de etkinleştir.)
 *   2) Oluşan client'ın JSON'unu indir (client_secret_....json).
 *   3) Çalıştır:  node scripts/prep-drive-oauth.mjs <indirilen-client.json-yolu>
 *   4) Açılan URL'yi tarayıcıda aç, Google hesabıyla izin ver (scope: drive).
 *      Yönlendirme http://localhost:8765 adresine döner; script kodu yakalar.
 *   5) Script gitignored `drive-credentials.json` dosyasını yazar VE DigitalOcean
 *      env'ine yapıştırılacak tek satırlık JSON'u ekrana basar:
 *        GOOGLE_DRIVE_CREDENTIALS_JSON = <o tek satır>
 *      Yerel dev için alternatif: .env.local içine
 *        GOOGLE_DRIVE_CREDENTIALS_FILE=./drive-credentials.json
 *
 * Not: refresh_token yalnızca prompt=consent ile döner; script bunu zorlar.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/drive';

function fail(msg) {
  console.error(`\nHATA: ${msg}`);
  process.exit(1);
}

// ── 1) OAuth client JSON'unu oku ──
const clientPath = process.argv[2];
if (!clientPath) {
  fail(
    'OAuth client JSON yolu gerekli.\n' +
    'Kullanım: node scripts/prep-drive-oauth.mjs <client_secret_....json>\n' +
    '(Google Cloud Console → Credentials → OAuth client ID → Desktop app → JSON indir)'
  );
}
let clientJson;
try {
  clientJson = JSON.parse(fs.readFileSync(clientPath, 'utf8'));
} catch (e) {
  fail(`Client JSON okunamadı (${clientPath}): ${e.message}`);
}
const cfg = clientJson.installed || clientJson.web;
if (!cfg?.client_id || !cfg?.client_secret) {
  fail('JSON içinde "installed" (Desktop app) client_id/client_secret bulunamadı. Desktop app tipi client oluşturduğundan emin ol.');
}

// ── 2) Yetkilendirme URL'sini üret ──
const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: cfg.client_id,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

console.log('\n1) Şu URL\'yi tarayıcıda aç ve izin ver:\n');
console.log(authUrl);
console.log(`\n2) İzin sonrası Google seni ${REDIRECT_URI} adresine yönlendirecek — bekleniyor...\n`);

// ── 3) Redirect'i localhost:8765'te yakala ──
const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, REDIRECT_URI);
    if (url.pathname !== '/') {
      res.writeHead(404).end();
      return;
    }
    const err = url.searchParams.get('error');
    const c = url.searchParams.get('code');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (err || !c) {
      res.end('<h2>Yetkilendirme başarısız 😕</h2><p>Bu pencereyi kapatıp terminale dönebilirsin.</p>');
      server.close();
      reject(new Error(`Google hata döndürdü: ${err || 'code yok'}`));
      return;
    }
    res.end('<h2>Tamamdır ✔</h2><p>Bu pencereyi kapatabilirsin — terminale dön.</p>');
    server.close();
    resolve(c);
  });
  server.on('error', (e) => {
    reject(new Error(`Port ${PORT} dinlenemedi: ${e.message} (başka bir uygulama mı kullanıyor?)`));
  });
  server.listen(PORT);
  // 5 dakika içinde dönüş olmazsa vazgeç
  setTimeout(() => {
    server.close();
    reject(new Error('5 dakika içinde yetkilendirme tamamlanmadı — script durduruldu.'));
  }, 5 * 60 * 1000).unref();
}).catch((e) => fail(e.message));

console.log('Kod alındı, token\'a çevriliyor...');

// ── 4) Kodu token'a çevir ──
let tokens;
try {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.client_id,
      client_secret: cfg.client_secret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });
  tokens = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(tokens).slice(0, 300)}`);
} catch (e) {
  fail(`Token değişimi başarısız: ${e.message}`);
}
if (!tokens.refresh_token) {
  fail(
    'Google refresh_token döndürmedi. Aynı client için daha önce izin verilmiş olabilir:\n' +
    'https://myaccount.google.com/permissions adresinden uygulama erişimini kaldırıp tekrar dene.'
  );
}

// ── 5) drive-credentials.json yaz + DO env değerini bas ──
const creds = {
  client_id: cfg.client_id,
  client_secret: cfg.client_secret,
  refresh_token: tokens.refresh_token,
  type: 'authorized_user',
};
const outPath = path.join(process.cwd(), 'drive-credentials.json');
fs.writeFileSync(outPath, JSON.stringify(creds, null, 2), 'utf8');
const minified = JSON.stringify(creds);

console.log(`\n✔ Yazıldı: ${outPath} (gitignored)`);
console.log('\nYerel dev (.env.local):');
console.log('  GOOGLE_DRIVE_CREDENTIALS_FILE=./drive-credentials.json');
console.log('\nDigitalOcean env değişkeni (ENCRYPTED olarak yapıştır):');
console.log('  GOOGLE_DRIVE_CREDENTIALS_JSON =');
console.log(minified);
console.log('\nİsteğe bağlı: yüklemelerin gideceği Drive klasörü için GOOGLE_DRIVE_ROOT_FOLDER_ID ayarla.');
