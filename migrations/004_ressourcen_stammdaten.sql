-- migrations/004_ressourcen_stammdaten.sql
-- Add Stammdaten fields + Arbeitsmodell/Location to ressourcen table

ALTER TABLE ressourcen
  ADD COLUMN IF NOT EXISTS rolle TEXT,
  ADD COLUMN IF NOT EXISTS arbeitsmodell TEXT NOT NULL DEFAULT 'Onshore'
    CHECK (arbeitsmodell IN ('Onshore', 'Nearshore', 'Offshore')),
  ADD COLUMN IF NOT EXISTS location TEXT,
  -- Persönliche Stammdaten
  ADD COLUMN IF NOT EXISTS vorname TEXT,
  ADD COLUMN IF NOT EXISTS nachname TEXT,
  ADD COLUMN IF NOT EXISTS namenszusatz TEXT,
  ADD COLUMN IF NOT EXISTS titel TEXT,
  ADD COLUMN IF NOT EXISTS geburtsdatum DATE,
  ADD COLUMN IF NOT EXISTS geschlecht TEXT
    CHECK (geschlecht IN ('Männlich', 'Weiblich', 'Divers', 'Keine Angabe')),
  ADD COLUMN IF NOT EXISTS firma TEXT,
  ADD COLUMN IF NOT EXISTS email_geschaeftlich TEXT,
  ADD COLUMN IF NOT EXISTS telefon_geschaeftlich TEXT,
  ADD COLUMN IF NOT EXISTS wohnort TEXT;

CREATE INDEX IF NOT EXISTS idx_ressourcen_arbeitsmodell ON ressourcen(arbeitsmodell);
CREATE INDEX IF NOT EXISTS idx_ressourcen_location ON ressourcen(location);
