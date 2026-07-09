-- DropIndex
DROP INDEX "SiteArticle_authorSlug_idx";

-- DropIndex
DROP INDEX "SiteArticle_status_scheduledAt_idx";

-- AlterTable
ALTER TABLE "Author" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "email" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "RecurringInvoice" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SavedReport" ALTER COLUMN "updatedAt" DROP DEFAULT;
