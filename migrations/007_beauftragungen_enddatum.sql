-- migrations/007_beauftragungen_enddatum.sql
-- Add enddatum column to beauftragungen table for pool-based assignments duration tracking

ALTER TABLE beauftragungen
  ADD COLUMN IF NOT EXISTS enddatum DATE;

CREATE INDEX IF NOT EXISTS idx_beauftragungen_startdatum ON beauftragungen(startdatum);
CREATE INDEX IF NOT EXISTS idx_beauftragungen_enddatum ON beauftragungen(enddatum);
