-- migrations/003_beauftragungen_preismodell.sql

-- 1. Neue Spalten hinzufügen (nullable zuerst für Backfill)
ALTER TABLE beauftragungen
  ADD COLUMN IF NOT EXISTS agentur_rohpreis numeric,
  ADD COLUMN IF NOT EXISTS marge_inkludiert boolean NOT NULL DEFAULT false;

-- 2. Bestehende Zeilen befüllen: Rohpreis = bisheriger EK (marge_inkludiert war immer false)
UPDATE beauftragungen
SET agentur_rohpreis = einkaufspreis
WHERE agentur_rohpreis IS NULL;

-- 3. NOT NULL setzen nach Backfill
ALTER TABLE beauftragungen
  ALTER COLUMN agentur_rohpreis SET NOT NULL;

-- Hinweis: verkaufspreis ist eine generated column (einkaufspreis + margenaufschlag)
-- und benötigt keinen manuellen Backfill.
