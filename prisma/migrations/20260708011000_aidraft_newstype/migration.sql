-- AI taslaklarına haber türü (son dakika / günlük / haftalık)
ALTER TABLE "AiDraft" ADD COLUMN IF NOT EXISTS "newsType" TEXT NOT NULL DEFAULT 'daily';
