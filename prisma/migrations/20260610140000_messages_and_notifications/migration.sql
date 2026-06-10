-- Notification table
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Message: conversationId/fromMe -> senderId/recipientId (backfill via first admin)
ALTER TABLE "Message" ADD COLUMN "senderId" TEXT;
ALTER TABLE "Message" ADD COLUMN "recipientId" TEXT;

UPDATE "Message" SET
  "senderId" = CASE WHEN "fromMe"
    THEN (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" ASC LIMIT 1)
    ELSE "conversationId" END,
  "recipientId" = CASE WHEN "fromMe"
    THEN "conversationId"
    ELSE (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" ASC LIMIT 1) END;

-- Drop rows that cannot be mapped to real users (orphaned test data)
DELETE FROM "Message" WHERE "senderId" IS NULL OR "recipientId" IS NULL
  OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = "Message"."senderId")
  OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = "Message"."recipientId");

ALTER TABLE "Message" ALTER COLUMN "senderId" SET NOT NULL;
ALTER TABLE "Message" ALTER COLUMN "recipientId" SET NOT NULL;
ALTER TABLE "Message" DROP COLUMN "conversationId";
ALTER TABLE "Message" DROP COLUMN "fromMe";

CREATE INDEX "Message_senderId_recipientId_idx" ON "Message"("senderId", "recipientId");

ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
