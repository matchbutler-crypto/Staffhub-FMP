-- PROJ-9: Freelancer-Pool CRUD
-- Tabelle ressourcen + RLS + Storage Bucket + Trigger

-- Enum Typen
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'erfahrungslevel_enum') THEN
    CREATE TYPE erfahrungslevel_enum AS ENUM ('Junior', 'Mid', 'Senior', 'Expert');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ressource_verfuegbarkeit_enum') THEN
    CREATE TYPE ressource_verfuegbarkeit_enum AS ENUM (
      'Jetzt verfügbar', 'Verfügbar ab', 'Nicht verfügbar', 'Deaktiviert'
    );
  END IF;
END $$;

-- Tabelle ressourcen
CREATE TABLE IF NOT EXISTS ressourcen (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agentur_id       UUID NOT NULL REFERENCES agenturen(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (char_length(name) <= 200),
  skills           TEXT[] NOT NULL DEFAULT '{}',
  erfahrungslevel  TEXT NOT NULL CHECK (erfahrungslevel IN ('Junior', 'Mid', 'Senior', 'Expert')),
  verfuegbarkeit   TEXT NOT NULL CHECK (verfuegbarkeit IN (
                     'Jetzt verfügbar', 'Verfügbar ab', 'Nicht verfügbar', 'Deaktiviert'
                   )),
  verfuegbar_ab    DATE,
  cv_pfad          TEXT,
  ek_tagesrate     NUMERIC(10, 2),
  notizen          TEXT CHECK (char_length(notizen) <= 2000),
  reminder_sent_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: updated_at automatisch setzen
CREATE TRIGGER set_ressourcen_updated_at
  BEFORE UPDATE ON ressourcen
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ressourcen_agentur_id   ON ressourcen(agentur_id);
CREATE INDEX IF NOT EXISTS idx_ressourcen_verfuegbarkeit ON ressourcen(verfuegbarkeit);
CREATE INDEX IF NOT EXISTS idx_ressourcen_updated_at    ON ressourcen(updated_at DESC);

-- RLS aktivieren
ALTER TABLE ressourcen ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agentur liest eigene Ressourcen" ON ressourcen
  FOR SELECT USING (
    get_my_rolle() IN ('Admin', 'Staffhub Manager')
    OR agentur_id = (
      SELECT agentur_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Agentur legt eigene Ressourcen an" ON ressourcen
  FOR INSERT WITH CHECK (
    get_my_rolle() = 'Agentur'
    AND agentur_id = (
      SELECT agentur_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Agentur aktualisiert eigene Ressourcen" ON ressourcen
  FOR UPDATE USING (
    get_my_rolle() = 'Agentur'
    AND agentur_id = (
      SELECT agentur_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Storage Bucket ressourcen-cvs (muss in Supabase Dashboard oder via API erstellt werden)
-- Bucket-Name: ressourcen-cvs, Public: false

-- Storage RLS Policies (für Supabase Storage)
-- Agentur kann eigene CVs hochladen/lesen (Pfad: {agentur_id}/{ressource_id}.pdf)
-- Manager/Admin kann alle CVs lesen
-- Diese Policies werden über die Supabase Storage API/Dashboard gesetzt.
