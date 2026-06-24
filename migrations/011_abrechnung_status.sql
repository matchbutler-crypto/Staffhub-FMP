-- 011_abrechnung_status.sql
-- 1. tage_ist_override von INTEGER auf NUMERIC(6,2) für Dezimalstunden
ALTER TABLE zeitnachweise
  ALTER COLUMN tage_ist_override TYPE NUMERIC(6,2) USING tage_ist_override::numeric;

-- 2. Abrechnungs-Status pro Beauftragung+Monat
ALTER TABLE zeitnachweise
  ADD COLUMN IF NOT EXISTS abrechnung_status TEXT NOT NULL DEFAULT 'Offen'
  CONSTRAINT abrechnung_status_check CHECK (abrechnung_status IN ('Offen', 'Rechnung gestellt', 'Bezahlt'));
