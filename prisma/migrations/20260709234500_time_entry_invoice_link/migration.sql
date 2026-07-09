-- ZAMAN→FATURA: TimeEntry'yi faturaya bağla (çift faturalamayı önler).
-- Additive + IF NOT EXISTS (prod-güvenli; hand-authored, migrate dev DEĞİL).

ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
CREATE INDEX IF NOT EXISTS "TimeEntry_invoiceId_idx" ON "TimeEntry" ("invoiceId");
