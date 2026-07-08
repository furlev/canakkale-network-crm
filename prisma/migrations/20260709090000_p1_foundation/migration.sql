-- P1 TEMEL: bülten çift-onay, yazar hub, tekrarlayan fatura, e-imza, web push, çoklu-kanal,
-- feribot, AI maliyet logu, reklamveren raporu, planlı yayın. Tümü additive/IF NOT EXISTS.

-- ── Subscriber: çift-onay + segment ──
ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "confirmToken" TEXT;
ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "unsubToken" TEXT;
ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "tags" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_unsubToken_key" ON "Subscriber" ("unsubToken");

-- ── Estimate / Contract / Proposal: dönüşüm akışı + public onay token ──
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "convertedToId" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "publicToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Estimate_publicToken_key" ON "Estimate" ("publicToken");
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "convertedToId" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "publicToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_publicToken_key" ON "Contract" ("publicToken");
ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "convertedToId" TEXT;
ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "publicToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Proposal_publicToken_key" ON "Proposal" ("publicToken");

-- ── Advertiser: self-servis rapor token ──
ALTER TABLE "Advertiser" ADD COLUMN IF NOT EXISTS "reportToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Advertiser_reportToken_key" ON "Advertiser" ("reportToken");

-- ── Folder: Drive klasör eşlemesi ──
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "driveFolderId" TEXT;

-- ── JoinApplication: Lead dönüşümü ──
ALTER TABLE "JoinApplication" ADD COLUMN IF NOT EXISTS "convertedLeadId" TEXT;

-- ── SiteArticle: yazar hub + planlı yayın ──
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "authorSlug" TEXT;
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "SiteArticle_authorSlug_idx" ON "SiteArticle" ("authorSlug");
CREATE INDEX IF NOT EXISTS "SiteArticle_status_scheduledAt_idx" ON "SiteArticle" ("status", "scheduledAt");

-- ── NewsletterRecipient (yeni) ──
CREATE TABLE IF NOT EXISTS "NewsletterRecipient" (
  "id" TEXT NOT NULL,
  "newsletterId" TEXT NOT NULL,
  "subscriberId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3),
  "clickedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterRecipient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NewsletterRecipient_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterRecipient_token_key" ON "NewsletterRecipient" ("token");
CREATE INDEX IF NOT EXISTS "NewsletterRecipient_newsletterId_idx" ON "NewsletterRecipient" ("newsletterId");

-- ── PushSubscription (yeni) ──
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "district" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription" ("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_district_idx" ON "PushSubscription" ("district");

-- ── Author (yeni) ──
CREATE TABLE IF NOT EXISTS "Author" (
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "bio" TEXT,
  "avatar" TEXT,
  "title" TEXT,
  "isColumnist" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Author_pkey" PRIMARY KEY ("slug")
);

-- ── RecurringInvoice (yeni) ──
CREATE TABLE IF NOT EXISTS "RecurringInvoice" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "title" TEXT NOT NULL,
  "items" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "interval" TEXT NOT NULL DEFAULT 'monthly',
  "nextRunAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RecurringInvoice_active_nextRunAt_idx" ON "RecurringInvoice" ("active", "nextRunAt");

-- ── Signature (yeni) ──
CREATE TABLE IF NOT EXISTS "Signature" (
  "id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ip" TEXT,
  "hash" TEXT,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Signature_entity_entityId_idx" ON "Signature" ("entity", "entityId");

-- ── SavedReport (yeni) ──
CREATE TABLE IF NOT EXISTS "SavedReport" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "config" TEXT NOT NULL,
  "ownerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

-- ── SocialPost (yeni) ──
CREATE TABLE IF NOT EXISTS "SocialPost" (
  "id" TEXT NOT NULL,
  "articleId" TEXT,
  "platform" TEXT NOT NULL DEFAULT 'instagram',
  "text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SocialPost_status_createdAt_idx" ON "SocialPost" ("status", "createdAt");

-- ── FerrySchedule (yeni) ──
CREATE TABLE IF NOT EXISTS "FerrySchedule" (
  "id" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "departTime" TEXT NOT NULL,
  "days" TEXT NOT NULL DEFAULT 'hergun',
  "operator" TEXT NOT NULL DEFAULT 'GESTAŞ',
  "season" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "FerrySchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FerrySchedule_route_active_idx" ON "FerrySchedule" ("route", "active");

-- ── AiUsageLog (yeni) ──
CREATE TABLE IF NOT EXISTS "AiUsageLog" (
  "id" TEXT NOT NULL,
  "fn" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "images" INTEGER,
  "costUsd" DOUBLE PRECISION,
  "ms" INTEGER,
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiUsageLog_createdAt_idx" ON "AiUsageLog" ("createdAt");
