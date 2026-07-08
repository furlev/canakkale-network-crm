-- Kategori bazlı liste + anasayfa kategori rayları için composite index.
-- (categorySlug) tek başına filtre+sıralamayı karşılamıyordu; publishedAt DESC
-- sıralaması bellek-içi yapılıyordu. Additive, güvenli.
CREATE INDEX IF NOT EXISTS "SiteArticle_categorySlug_publishedAt_idx"
  ON "SiteArticle" ("categorySlug", "publishedAt");
