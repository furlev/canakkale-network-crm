-- SITE FUNC ENHANCEMENT (G-B): arama GIN index + son dakika push mükerrer koruması.
-- Tümü additive + IF NOT EXISTS (prod-güvenli; hand-authored, migrate dev DEĞİL).

-- ── Son dakika push dedup damgası ──
-- Bir haber son dakika (isBreaking) yayınlanınca web push best-effort tetiklenir;
-- bu sütun mükerrer gönderimi engeller (bir kez damgalanır, atomik claim ile).
ALTER TABLE "SiteArticle" ADD COLUMN IF NOT EXISTS "breakingPushedAt" TIMESTAMP(3);

-- ── Arama GIN index ──
-- /haberler araması to_tsvector('turkish', title+summary) @@ plainto_tsquery kullanır.
-- Bu ifade-index GIN ile seq-scan yerine indeks taraması sağlar. to_tsvector'ın
-- regconfig'i sabit literal olduğundan ifade IMMUTABLE'dır (index'lenebilir).
CREATE INDEX IF NOT EXISTS "SiteArticle_search_tsv_idx"
  ON "SiteArticle"
  USING GIN (to_tsvector('turkish', coalesce(title, '') || ' ' || coalesce(summary, '')));
