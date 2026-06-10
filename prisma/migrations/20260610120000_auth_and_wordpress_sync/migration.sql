-- AlterTable
ALTER TABLE "News" ADD COLUMN     "url" TEXT,
ADD COLUMN     "wpId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "News_wpId_key" ON "News"("wpId");

