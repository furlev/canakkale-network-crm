-- P0 TEMEL: ilçe ekseni + analitik + AI güven katmanı + Finans 2.0 + reklam envanteri
-- Tümü additive & idempotent (IF NOT EXISTS) — prod'da mevcut veriyle güvenli.

-- ── SiteArticle: ilçe, galeri, düzeltme/geri-çekme ──
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "gallery" TEXT;
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "correctionNote" TEXT;
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "correctedAt" TIMESTAMP(3);
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "retractedAt" TIMESTAMP(3);
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "retractionNote" TEXT;
CREATE INDEX IF NOT EXISTS "SiteArticle_district_publishedAt_idx" ON "SiteArticle" ("district", "publishedAt");

-- ── AiDraft: ilçe, kalite/özgünlük, çelişki, redaksiyon notu, planlama, IG ──
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "qualityScore" DOUBLE PRECISION;
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "originalityScore" DOUBLE PRECISION;
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "sourceCount" INTEGER;
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "hasContradiction" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "editorNote" TEXT;
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "igAssets" TEXT;
CREATE INDEX IF NOT EXISTS "AiDraft_scheduledAt_idx" ON "AiDraft" ("scheduledAt");

-- ── FeedItem: ilçe/gürültü filtresi, embedding kümeleme, medya ──
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "isLocal" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "embedding" TEXT;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "clusterId" TEXT;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "importance" DOUBLE PRECISION;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
CREATE INDEX IF NOT EXISTS "FeedItem_clusterId_idx" ON "FeedItem" ("clusterId");

-- ── NewsSource: güven puanı, tip, coğrafi kapsam, sağlık ──
ALTER TABLE "NewsSource" ADD COLUMN IF NOT EXISTS "trustScore" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "NewsSource" ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "NewsSource" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "NewsSource" ADD COLUMN IF NOT EXISTS "lastItemCount" INTEGER;
ALTER TABLE "NewsSource" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

-- ── Invoice: Finans 2.0 (para birimi, KDV, PDF, gönderim, reklam bağı) ──
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TRY';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "subtotal" DOUBLE PRECISION;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "vatTotal" DOUBLE PRECISION;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "discount" DOUBLE PRECISION;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "reminderCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "advertiserId" TEXT;

-- ── InvoiceItem (yeni): kalemli fatura ──
CREATE TABLE IF NOT EXISTS "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem" ("invoiceId");

-- ── AdCampaign: reklam envanteri (görsel/hedef/ağırlık/ilçe) ──
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "creativeUrl" TEXT;
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "targetUrl" TEXT;
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "weight" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AdCampaign" ADD COLUMN IF NOT EXISTS "districts" TEXT;

-- ── AdEvent (yeni): gösterim/tık ölçümü ──
CREATE TABLE IF NOT EXISTS "AdEvent" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AdEvent_campaignId_createdAt_idx" ON "AdEvent" ("campaignId", "createdAt");

-- ── Tip: site ihbarından üretilen taslak bağı ──
ALTER TABLE "Tip" ADD COLUMN IF NOT EXISTS "draftId" TEXT;

-- ── ArticleEvent (yeni): site analitik olay tablosu ──
CREATE TABLE IF NOT EXISTS "ArticleEvent" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "referrerHost" TEXT,
  "deviceType" TEXT,
  "district" TEXT,
  "sessionHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ArticleEvent_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "SiteArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ArticleEvent_articleId_createdAt_idx" ON "ArticleEvent" ("articleId", "createdAt");
CREATE INDEX IF NOT EXISTS "ArticleEvent_createdAt_idx" ON "ArticleEvent" ("createdAt");
CREATE INDEX IF NOT EXISTS "ArticleEvent_type_createdAt_idx" ON "ArticleEvent" ("type", "createdAt");

-- ── NobetciEczane (yeni): günlük nöbetçi eczane (il + 11 ilçe) ──
CREATE TABLE IF NOT EXISTS "NobetciEczane" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "district" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "mapsUrl" TEXT,
  "source" TEXT NOT NULL DEFAULT 'api',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NobetciEczane_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NobetciEczane_date_district_name_key" ON "NobetciEczane" ("date", "district", "name");
CREATE INDEX IF NOT EXISTS "NobetciEczane_date_district_idx" ON "NobetciEczane" ("date", "district");
