-- Görüntülenme takviyesi: habere özel yapılandırma (global ayar Setting('viewBoost') içinde durur).
-- Tamamen additive — mevcut veriye dokunmaz.
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "viewBoost" JSONB;
