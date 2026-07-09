# Performans & Core Web Vitals — Çanakkale Network

Public haber sitesi (`canakkale.network`) SEO ve okuyucu deneyimi için CWV'ye duyarlıdır.
Bu not hedefleri ve mevcut bilinçli ödünleşimleri kaydeder.

## Hedefler (saha / 75. persentil)

| Metrik | Hedef | Not |
|--------|-------|-----|
| **LCP** (Largest Contentful Paint) | < 2.5 sn | Haber kapak görseli genelde LCP öğesidir |
| **CLS** (Cumulative Layout Shift) | < 0.1  | Görsellere width/height ver; font swap'ı yönet |
| **INP** (Interaction to Next Paint) | < 200 ms | Ağır client JS'i bölmele; gereksiz hydration'dan kaçın |

## Uygulanan güvenli iyileştirmeler

- `next.config.js`: `compress: true` (metin varlıkları sıkıştırılır), `poweredByHeader: false`.
- Güvenli global başlıklar (nosniff, frame-options, referrer-policy, permissions-policy) — CSP
  **eklenmedi** (aşağıdaki nota bakın).

## Bilinçli ödünleşim: `images.unoptimized = true`

Şu an haber görselleri **base64 data-URI** olarak DB'de (`SiteArticle`/`AiDraft.imageUrl`) tutuluyor
ve `<img>` ile basılıyor. `next/image` optimizasyonu bu data-URI/harici rota kurgusunu bozabildiği için
**kapalı** (`unoptimized: true`). Bu bilinçli bir karardır — dokunmayın.

### `next/image`'in açılacağı koşul (gelecek iş — bu ajanın kapsamı DIŞINDA)

1. Görseller **object storage**'a (S3/Spaces — `@aws-sdk/client-s3` zaten bağımlı) taşınır; DB yalnız
   URL tutar (satırlar küçülür, sorgular hızlanır).
2. `next.config.js` → `images.remotePatterns`'e storage host'u eklenir, `unoptimized` kaldırılır.
3. `<img>` → `next/image`'e geçilir (LCP görseli `priority`, altındakiler `loading="lazy"`, sabit
   `width/height` ile CLS=0). Ancak bu tek atımda ve object-storage göçüyle BİRLİKTE yapılmalı.

## CSP notu

İçerik Güvenlik Politikası (CSP) **eklenmedi**: mevcut inline stiller ve olası inline script'leri
kırma riski var. Doğru zaman, statik varlıkların storage'a taşınıp nonce/hash tabanlı bir CSP'nin
ölçülü şekilde devreye alınabileceği aşamadır.

## Ölçüm

- Lab: Chrome DevTools → Lighthouse (Performance) veya `npx unlighthouse`.
- Saha: mümkünse `web-vitals` ile gerçek kullanıcı ölçümü (henüz bağlı değil — opsiyonel gelecek iş).
