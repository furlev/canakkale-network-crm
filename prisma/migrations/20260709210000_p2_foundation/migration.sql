-- P2 TEMEL: trend, yorum, okuyucu hesabı, canlı blog, zaman takibi, proje şablonu,
-- İK-lite (izin/mesai), A/B başlık, paywall, bildirim merkezi, görev bağımlılığı.
-- Tümü additive + IF NOT EXISTS (prod-güvenli; hand-authored, migrate dev DEĞİL).

-- ── Mevcut modellere alanlar ──
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "dependsOnId" TEXT;
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "altTitle" TEXT;
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "titleVariants" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyPrefs" TEXT;
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification" ("userId", "read");

-- ── ArticleViewDaily (trend) ──
CREATE TABLE IF NOT EXISTS "ArticleViewDaily" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ArticleViewDaily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ArticleViewDaily_articleId_date_key" ON "ArticleViewDaily" ("articleId", "date");
CREATE INDEX IF NOT EXISTS "ArticleViewDaily_date_idx" ON "ArticleViewDaily" ("date");

-- ── SiteComment (yorum + moderasyon) ──
CREATE TABLE IF NOT EXISTS "SiteComment" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "aiScore" DOUBLE PRECISION,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SiteComment_articleId_status_idx" ON "SiteComment" ("articleId", "status");
CREATE INDEX IF NOT EXISTS "SiteComment_status_createdAt_idx" ON "SiteComment" ("status", "createdAt");

-- ── SiteReader (okuyucu hesabı — CRM User'dan ayrı) ──
CREATE TABLE IF NOT EXISTS "SiteReader" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT,
  "name" TEXT,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "premiumUntil" TIMESTAMP(3),
  "confirmToken" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteReader_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SiteReader_email_key" ON "SiteReader" ("email");

-- ── LiveBlog + LiveBlogEntry (canlı blog) ──
CREATE TABLE IF NOT EXISTS "LiveBlog" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "articleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveBlog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LiveBlog_slug_key" ON "LiveBlog" ("slug");
CREATE TABLE IF NOT EXISTS "LiveBlogEntry" (
  "id" TEXT NOT NULL,
  "liveBlogId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "important" BOOLEAN NOT NULL DEFAULT false,
  "authorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveBlogEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LiveBlogEntry_liveBlogId_createdAt_idx" ON "LiveBlogEntry" ("liveBlogId", "createdAt");

-- ── TimeEntry (zaman takibi) ──
CREATE TABLE IF NOT EXISTS "TimeEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "taskId" TEXT,
  "minutes" INTEGER NOT NULL,
  "billable" BOOLEAN NOT NULL DEFAULT true,
  "rate" DOUBLE PRECISION,
  "note" TEXT,
  "date" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TimeEntry_userId_date_idx" ON "TimeEntry" ("userId", "date");
CREATE INDEX IF NOT EXISTS "TimeEntry_projectId_idx" ON "TimeEntry" ("projectId");

-- ── ProjectTemplate (proje şablonu) ──
CREATE TABLE IF NOT EXISTS "ProjectTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "tasks" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

-- ── LeaveRequest (İK izin) ──
CREATE TABLE IF NOT EXISTS "LeaveRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'annual',
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "approverId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeaveRequest_userId_status_idx" ON "LeaveRequest" ("userId", "status");
CREATE INDEX IF NOT EXISTS "LeaveRequest_status_startDate_idx" ON "LeaveRequest" ("status", "startDate");

-- ── Attendance (mesai) ──
CREATE TABLE IF NOT EXISTS "Attendance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "checkIn" TIMESTAMP(3),
  "checkOut" TIMESTAMP(3),
  "note" TEXT,
  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_userId_date_key" ON "Attendance" ("userId", "date");
