-- PROJ-6: Beauftragungen + Margenberechnung
-- Führe diese SQL im Supabase Dashboard → SQL Editor aus.

CREATE TABLE IF NOT EXISTS beauftragungen (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profil_id        UUID NOT NULL REFERENCES kandidaten_profile(id) ON DELETE RESTRICT,
  agentur_id       UUID NOT NULL REFERENCES agenturen(id) ON DELETE RESTRICT,
  einkaufspreis    DECIMAL(10,2) NOT NULL CHECK (einkaufspreis >= 0),
  margenaufschlag  DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (margenaufschlag >= 0),
  verkaufspreis    DECIMAL(10,2) GENERATED ALWAYS AS (einkaufspreis + margenaufschlag) STORED,
  startdatum       DATE NOT NULL,
  stunden_woche    INTEGER NOT NULL CHECK (stunden_woche > 0 AND stunden_woche <= 168),
  aktiv            BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE beauftragungen ENABLE ROW LEVEL SECURITY;

-- Nur Manager und Admin haben Zugriff auf Beauftragungen
CREATE POLICY "Manager sieht alle Beauftragungen" ON beauftragungen
  FOR SELECT USING (get_my_rolle() IN ('Staffhub Manager', 'Admin'));

CREATE POLICY "Manager kann Beauftragungen anlegen" ON beauftragungen
  FOR INSERT WITH CHECK (get_my_rolle() IN ('Staffhub Manager', 'Admin'));

CREATE POLICY "Manager kann Beauftragungen bearbeiten" ON beauftragungen
  FOR UPDATE USING (get_my_rolle() IN ('Staffhub Manager', 'Admin'));

DROP TRIGGER IF EXISTS beauftragungen_updated_at ON beauftragungen;
CREATE TRIGGER beauftragungen_updated_at
  BEFORE UPDATE ON beauftragungen
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_beauftragungen_agentur_id ON beauftragungen(agentur_id);
CREATE INDEX IF NOT EXISTS idx_beauftragungen_profil_id  ON beauftragungen(profil_id);
CREATE INDEX IF NOT EXISTS idx_beauftragungen_aktiv      ON beauftragungen(aktiv);
