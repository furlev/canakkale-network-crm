-- Özel haber sitesi (canakkale.network) modelleri: Article, SiteCategory, SitePage, JoinApplication
-- + AiDraft.articleId (siteye yayın hedefi)

-- AlterTable
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "articleId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteCategory" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "showInNav" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SiteCategory_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "categorySlug" TEXT,
    "tags" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "imageIsAi" BOOLEAN NOT NULL DEFAULT false,
    "videoUrl" TEXT,
    "authorName" TEXT NOT NULL DEFAULT 'Çanakkale Network',
    "authorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "newsType" TEXT NOT NULL DEFAULT 'daily',
    "isBreaking" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isEditorPick" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "sourceDraftId" TEXT,
    "sourceLinks" TEXT,
    "wpId" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SitePage" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "JoinApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "data" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JoinApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SiteArticle_slug_key" ON "SiteArticle"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "SiteArticle_wpId_key" ON "SiteArticle"("wpId");
CREATE INDEX IF NOT EXISTS "SiteArticle_status_publishedAt_idx" ON "SiteArticle"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "SiteArticle_categorySlug_idx" ON "SiteArticle"("categorySlug");
CREATE INDEX IF NOT EXISTS "SiteArticle_isBreaking_publishedAt_idx" ON "SiteArticle"("isBreaking", "publishedAt");
CREATE INDEX IF NOT EXISTS "JoinApplication_status_createdAt_idx" ON "JoinApplication"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SiteArticle" ADD CONSTRAINT "SiteArticle_categorySlug_fkey" FOREIGN KEY ("categorySlug") REFERENCES "SiteCategory"("slug") ON DELETE SET NULL ON UPDATE CASCADE;
