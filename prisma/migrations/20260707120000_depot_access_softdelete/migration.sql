-- AlterTable (soft delete alanları)
ALTER TABLE "Client" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "recurrence" TEXT;
ALTER TABLE "Lead" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
ALTER TABLE "Estimate" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable (Document depo alanları)
ALTER TABLE "Document" ADD COLUMN "mime" TEXT;
ALTER TABLE "Document" ADD COLUMN "driveFileId" TEXT;
ALTER TABLE "Document" ADD COLUMN "uploadedById" TEXT;
ALTER TABLE "Document" ADD COLUMN "folderId" TEXT;
ALTER TABLE "Document" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "minLevel" TEXT NOT NULL DEFAULT 'C',
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolderAccess" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FolderAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRule" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "targetRole" TEXT,
    "targetUserId" TEXT,
    "allow" BOOLEAN NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");
CREATE UNIQUE INDEX "FolderAccess_folderId_userId_key" ON "FolderAccess"("folderId", "userId");
CREATE INDEX "AccessRule_path_idx" ON "AccessRule"("path");
CREATE INDEX "AccessRule_targetUserId_idx" ON "AccessRule"("targetUserId");
CREATE INDEX "Document_folderId_idx" ON "Document"("folderId");

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolderAccess" ADD CONSTRAINT "FolderAccess_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
