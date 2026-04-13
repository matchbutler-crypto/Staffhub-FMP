-- PROJ-5: Profil-Status-Workflow + Kommentarfunktion
-- Führe diese SQL im Supabase Dashboard → SQL Editor aus.

-- ── 1. Kommentare-Tabelle ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profil_kommentare (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profil_id   UUID NOT NULL REFERENCES kandidaten_profile(id) ON DELETE CASCADE,
  autor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_rolle TEXT NOT NULL,
  text        TEXT NOT NULL CHECK (char_length(text) <= 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profil_kommentare ENABLE ROW LEVEL SECURITY;

-- ── 2. RLS Policies ────────────────────────────────────────────────────────────

-- SELECT: Agentur sieht nur Kommentare zu eigenen Profilen; Manager/Admin sehen alle
CREATE POLICY "Kommentare lesen" ON profil_kommentare
  FOR SELECT USING (
    get_my_rolle() IN ('Staffhub Manager', 'Admin')
    OR EXISTS (
      SELECT 1 FROM kandidaten_profile kp
      WHERE kp.id = profil_kommentare.profil_id
        AND kp.agentur_id = get_my_agentur_id()
    )
  );

-- INSERT: Alle aktiven authentifizierten User mit gültiger Rolle
CREATE POLICY "Kommentar schreiben" ON profil_kommentare
  FOR INSERT WITH CHECK (
    autor_id = auth.uid()
    AND get_my_rolle() IN ('Staffhub Manager', 'Admin', 'Agentur')
  );

-- DELETE: Niemand (Kommentare sind permanent — Audit-Trail)
CREATE POLICY "Kommentare nicht loeschbar" ON profil_kommentare
  FOR DELETE USING (false);

-- ── 3. Indizes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_kommentare_profil_id  ON profil_kommentare(profil_id);
CREATE INDEX IF NOT EXISTS idx_kommentare_created_at ON profil_kommentare(created_at ASC);

-- ── 4. BUG-01 Fix: Manager-RLS für kandidaten_profile (falls noch nicht angewendet) ───

DROP POLICY IF EXISTS "Agentur sieht eigene Profile" ON kandidaten_profile;
CREATE POLICY "Agentur sieht eigene Profile" ON kandidaten_profile
  FOR SELECT USING (
    agentur_id = get_my_agentur_id()
    OR get_my_rolle() IN ('Staffhub Manager', 'Admin')
  );

DROP POLICY IF EXISTS "Manager kann Status aktualisieren" ON kandidaten_profile;
CREATE POLICY "Manager kann Status aktualisieren" ON kandidaten_profile
  FOR UPDATE USING (
    get_my_rolle() IN ('Staffhub Manager', 'Admin')
  );
