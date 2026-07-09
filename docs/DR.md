# Yedekleme & Felaket Kurtarma (DR) — Çanakkale Network CRM

Kısa, uygulanabilir prosedür. Üretim: DigitalOcean App Platform + **DO Managed PostgreSQL**.

## 1. Veritabanı yedeği (birincil)

DigitalOcean Managed PostgreSQL **otomatik günlük yedek** alır ve **Point-in-Time Recovery (PITR)**
sunar (plana göre ~7 güne kadar geri sarma).

- **Kontrol:** DO Console → Databases → (cluster) → **Backups**. Son yedeğin tarihini ve PITR
  penceresini doğrula.
- **Geri yükleme:** Console → Backups → *Restore* ile **yeni** bir cluster'a geri al (mevcut prod
  cluster'ın üstüne YAZMA). Sağlığı doğrulandıktan sonra `DATABASE_URL`'i yeni cluster'a çevir.
- **Manuel anlık yedek (opsiyonel, sürüm/riskli işlem öncesi):**
  ```bash
  # Yalnız yerel/güvenli ortamdan; connection string'i loglama.
  pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%Y%m%d_%H%M).dump
  # Geri yükleme (YENİ/boş DB'ye):
  pg_restore --clean --if-exists -d "$TARGET_DATABASE_URL" backup_XXXX.dump
  ```

## 2. Migration disiplini (veri kaybını önler)

- Şema değişiklikleri **additive** olmalı: kolon/tablo ekle; **DROP/RENAME**'den kaçın (eski deploy
  hâlâ ayaktayken kırar). Zorunluysa iki aşamalı yap (önce ekle+çift-yaz, sonra ayrı sürümde kaldır).
- Migration'lar repoda tutulur; prod build sırasında `npx prisma migrate deploy` çalışır.
  **Prod'da asla** `migrate dev` / `db push` / `migrate reset` kullanma.
- Riskli migration öncesi **manuel `pg_dump`** al (yukarıda).

## 3. Seed guard (yanlış hedefe seed'i önler)

`scripts/seed-dev.mjs` ve `scripts/seed-news-sources.mjs` başında **prod-guard** vardır:
`NODE_ENV=production` **ya da** `DATABASE_URL` host'u `ondigitalocean.com` / `render.com` içeriyorsa
script hata basıp çıkar. Bilerek geçmek için `--force` bayrağı gerekir (yalnız istisnai durumlar).
Prod'da resmi haber-kaynağı seed yolu: `POST /api/admin/seed-sources` (idempotent).

## 4. Sırların/konfigürasyonun kurtarılması

- Env değerleri **DO Console → App → Settings → Environment** içindedir (repoda değil). App yeniden
  kurulursa buradan yeniden girilir. Değerleri `.env`/`.env.local` yerelde tutulur (gitignore).
- Runtime konfigürasyonun bir kısmı DB'dedir (`Setting`: WordPress bağlantısı, AI anahtarı). **Taze bir
  DB, WP sync / Ayarlar-anahtarı AI çalışmadan önce `/settings`'ten doldurulmalıdır.**
- Vertex kimliği: `GOOGLE_VERTEX_CREDENTIALS_JSON` (authorized_user ADC). Kaybolursa
  `scripts/prep-do-vertex.mjs` ile yerel ADC'den yeniden paketlenir.

## 5. Kurtarma tatbikatı (öneri)

Çeyrekte bir: son yedeği **yeni** bir DO cluster'a geri yükle, uygulamayı o cluster'a bağlı bir
staging'de aç, `/api/health` 200 ve birkaç kritik akış (login, haber listesi) çalışıyor mu doğrula.
Hedef: **RPO ≤ 24s** (günlük yedek) / PITR ile daha düşük; **RTO ≤ 1s** (restore + env).
