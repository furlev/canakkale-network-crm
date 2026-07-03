-- CreateTable
CREATE TABLE "NewsSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'rss',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "needsUA" BOOLEAN NOT NULL DEFAULT false,
    "lastFetchedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceName" TEXT,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "guidHash" TEXT NOT NULL,
    "summary" TEXT,
    "pubDate" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedInDraft" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDraft" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "category" TEXT,
    "tags" TEXT,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "socialPost" TEXT,
    "imageUrl" TEXT,
    "sources" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "wpId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedItem_guidHash_key" ON "FeedItem"("guidHash");

-- CreateIndex
CREATE INDEX "FeedItem_fetchedAt_idx" ON "FeedItem"("fetchedAt");

-- CreateIndex
CREATE INDEX "AiDraft_status_idx" ON "AiDraft"("status");

-- AddForeignKey
ALTER TABLE "FeedItem" ADD CONSTRAINT "FeedItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
