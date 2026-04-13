-- PROJ-4: KI-Bewertung via Ollama
-- Führe diese SQL im Supabase Dashboard → SQL Editor aus.

CREATE TABLE IF NOT EXISTS ki_bewertungen (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profil_id    UUID NOT NULL REFERENCES kandidaten_profile(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  empfehlung   TEXT NOT NULL CHECK (empfehlung IN ('Empfohlen', 'Bedingt geeignet', 'Nicht geeignet')),
  begruendung  TEXT NOT NULL,
  skill_vorhanden TEXT[] NOT NULL DEFAULT '{}',
  skill_fehlend   TEXT[] NOT NULL DEFAULT '{}',
  model        TEXT NOT NULL DEFAULT 'llama3.2',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ki_bewertungen ENABLE ROW LEVEL SECURITY;

-- Manager und Admin sehen alle Bewertungen
CREATE POLICY "Manager sieht alle KI-Bewertungen" ON ki_bewertungen
  FOR SELECT USING (get_my_rolle() IN ('Staffhub Manager', 'Admin'));

-- Agentur sieht nur Bewertungen für eigene Profile
CREATE POLICY "Agentur sieht KI-Bewertungen für eigene Profile" ON ki_bewertungen
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kandidaten_profile kp
      WHERE kp.id = ki_bewertungen.profil_id
        AND kp.agentur_id = get_my_agentur_id()
    )
  );

-- Manager/Admin und Agentur (nur für eigene Profile) können Bewertungen anlegen
CREATE POLICY "Authentifizierter User kann KI-Bewertungen anlegen" ON ki_bewertungen
  FOR INSERT WITH CHECK (
    get_my_rolle() IN ('Staffhub Manager', 'Admin')
    OR EXISTS (
      SELECT 1 FROM kandidaten_profile kp
      WHERE kp.id = ki_bewertungen.profil_id
        AND kp.agentur_id = get_my_agentur_id()
    )
  );

-- Index für schnelle Abfragen nach Profil
CREATE INDEX IF NOT EXISTS idx_ki_bewertungen_profil_id ON ki_bewertungen(profil_id);
CREATE INDEX IF NOT EXISTS idx_ki_bewertungen_created_at ON ki_bewertungen(created_at DESC);
