-- Lead: iletişim/başvuru alanları (email/phone/notes/source).
-- Tamamen additive + IF NOT EXISTS + prod-güvenli. (P1 tablo/indeks drift'i buradan
-- ÇIKARILDI: bu migration prod'da p1_foundation'dan ÖNCE sıralandığı için o objeler
-- henüz mevcut değil; drift kozmetik olduğundan p1_foundation'ın ürettiği hâliyle bırakıldı.)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "source" TEXT;
