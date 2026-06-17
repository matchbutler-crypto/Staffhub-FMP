-- migrations/009_magentaos_integration.sql
-- Felder für Magenta OS Demand-Client-Anbindung

-- Idempotenz-Schlüssel für externe Demand-Clients (z.B. Magenta OS)
-- vakanzen ist eine View — Spalte auf der Basistabelle vakanzen_data anlegen
ALTER TABLE vakanzen_data
  ADD COLUMN IF NOT EXISTS external_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vakanzen_data_external_ref
  ON vakanzen_data(external_ref)
  WHERE external_ref IS NOT NULL;

-- Freitext-Notiz bei Vorschlag-Statusänderung (SHORTLISTED/REJECTED/ACCEPTED)
ALTER TABLE ressource_vakanz_links
  ADD COLUMN IF NOT EXISTS note TEXT;

-- vakanzen-View um external_ref erweitern
CREATE OR REPLACE VIEW vakanzen AS
SELECT
  id,
  titel,
  branche,
  kunde,
  rolle,
  beschreibung,
  skills,
  skills_nice_have,
  erfahrungslevel,
  startdatum,
  laufzeit,
  enddatum,
  teamgroesse,
  fte_anzahl,
  auslastung,
  arbeitsmodell,
  onsite_anteil,
  ansprechpartner,
  status,
  standort,
  created_at,
  updated_at,
  created_by,
  slack_detail_posted_at,
  budget_intern,
  CASE WHEN get_my_rolle() = ANY (ARRAY['Admin'::text, 'Staffhub Manager'::text])
    THEN slack_ts ELSE NULL::text END AS slack_ts,
  CASE WHEN get_my_rolle() = ANY (ARRAY['Admin'::text, 'Staffhub Manager'::text])
    THEN weitere_kommentare ELSE NULL::text END AS weitere_kommentare,
  besetzt_seit,
  published,
  published_at,
  vakanz_nr,
  external_ref
FROM vakanzen_data;

-- Neuer Status-Wert "Shortlist" falls CHECK-Constraint vorhanden
-- (nur ausführen wenn CHECK-Constraint existiert und "Shortlist" noch nicht enthalten ist)
-- ALTER TABLE ressource_vakanz_links DROP CONSTRAINT IF EXISTS ressource_vakanz_links_status_check;
-- ALTER TABLE ressource_vakanz_links ADD CONSTRAINT ressource_vakanz_links_status_check
--   CHECK (status IN ('Vorgeschlagen', 'Shortlist', 'Zugesagt', 'Abgelehnt', 'Zurückgezogen'));
