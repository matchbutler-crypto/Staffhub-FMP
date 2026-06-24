-- migrations/014_ressourcen_datenschutz.sql
-- Adds datenschutz_pfad column for privacy policy screenshot uploads

ALTER TABLE ressourcen
  ADD COLUMN IF NOT EXISTS datenschutz_pfad TEXT;
