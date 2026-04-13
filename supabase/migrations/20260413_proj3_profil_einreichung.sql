-- PROJ-3: Profil-Einreichung + CV-Upload
-- Erweitert die in der Initialmirgation angelegte Tabelle kandidaten_profile
-- um ki_score, updated_at, korrigierte RLS-Policies und Storage-Bucket-Policies.

-- ── 1. Fehlende Spalten ergänzen ───────────────────────────────────────────────

ALTER TABLE kandidaten_profile
  ADD COLUMN IF NOT EXISTS ki_score INTEGER CHECK (ki_score >= 0 AND ki_score <= 100),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── 2. updated_at Trigger ──────────────────────────────────────────────────────

-- set_updated_at() wurde bereits in PROJ-2 angelegt
DROP TRIGGER IF EXISTS kandidaten_profile_updated_at ON kandidaten_profile;
CREATE TRIGGER kandidaten_profile_updated_at
  BEFORE UPDATE ON kandidaten_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. get_my_agentur_id() als SECURITY DEFINER ────────────────────────────────
-- Ohne SECURITY DEFINER würde die Funktion im Kontext des aufrufenden Users
-- laufen und so eine rekursive RLS-Schleife auslösen.

CREATE OR REPLACE FUNCTION get_my_agentur_id()
RETURNS UUID AS $$
  SELECT agentur_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── 4. RLS Policies für kandidaten_profile ─────────────────────────────────────

ALTER TABLE kandidaten_profile ENABLE ROW LEVEL SECURITY;

-- SELECT: Agentur sieht nur eigene; Manager/Admin sieht alle
DROP POLICY IF EXISTS "Agentur sieht eigene Profile" ON kandidaten_profile;
CREATE POLICY "Agentur sieht eigene Profile" ON kandidaten_profile
  FOR SELECT USING (
    agentur_id = get_my_agentur_id()
    OR get_my_rolle() IN ('Manager', 'Admin')
  );

-- INSERT: Nur Agenturen dürfen einreichen (eigene agentur_id)
DROP POLICY IF EXISTS "Agentur kann Profile einreichen" ON kandidaten_profile;
CREATE POLICY "Agentur kann Profile einreichen" ON kandidaten_profile
  FOR INSERT WITH CHECK (
    get_my_rolle() = 'Agentur'
    AND agentur_id = get_my_agentur_id()
  );

-- UPDATE: Nur eigene Profile, nur wenn Status = 'Eingereicht'
DROP POLICY IF EXISTS "Agentur kann eigene Profile bearbeiten" ON kandidaten_profile;
CREATE POLICY "Agentur kann eigene Profile bearbeiten" ON kandidaten_profile
  FOR UPDATE USING (
    agentur_id = get_my_agentur_id()
    AND status = 'Eingereicht'
  ) WITH CHECK (
    agentur_id = get_my_agentur_id()
  );

-- Manager darf Status updaten (für Profil-Status-Workflow in PROJ-5)
DROP POLICY IF EXISTS "Manager kann Status aktualisieren" ON kandidaten_profile;
CREATE POLICY "Manager kann Status aktualisieren" ON kandidaten_profile
  FOR UPDATE USING (
    get_my_rolle() IN ('Manager', 'Admin')
  );

-- DELETE: Nur eigene Profile, nur wenn Status = 'Eingereicht'
DROP POLICY IF EXISTS "Agentur kann eigene Profile loeschen" ON kandidaten_profile;
CREATE POLICY "Agentur kann eigene Profile loeschen" ON kandidaten_profile
  FOR DELETE USING (
    agentur_id = get_my_agentur_id()
    AND status = 'Eingereicht'
  );

-- ── 5. Indizes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_kandprof_vakanz_id   ON kandidaten_profile(vakanz_id);
CREATE INDEX IF NOT EXISTS idx_kandprof_agentur_id  ON kandidaten_profile(agentur_id);
CREATE INDEX IF NOT EXISTS idx_kandprof_status       ON kandidaten_profile(status);
CREATE INDEX IF NOT EXISTS idx_kandprof_created_at   ON kandidaten_profile(created_at DESC);

-- ── 6. Storage RLS für cv-uploads Bucket ──────────────────────────────────────
-- Bucket muss zuerst im Supabase Dashboard oder per API angelegt werden:
-- Name: cv-uploads, Public: false

-- INSERT: Authentifizierte User mit gültiger Rolle dürfen hochladen
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES
  (
    'Agentur kann CVs hochladen',
    'cv-uploads',
    'INSERT',
    'auth.role() = ''authenticated'' AND get_my_rolle() = ''Agentur'''
  )
ON CONFLICT (name, bucket_id, operation) DO NOTHING;

-- SELECT: Agentur sieht eigene CVs; Manager/Admin sehen alle
-- (Prüfung über kandidaten_profile JOIN)
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES
  (
    'CV-Zugriff kontrolliert',
    'cv-uploads',
    'SELECT',
    $policy$
    get_my_rolle() IN ('Manager', 'Admin')
    OR EXISTS (
      SELECT 1 FROM kandidaten_profile kp
      WHERE kp.cv_pfad = storage.objects.name
        AND kp.agentur_id = get_my_agentur_id()
    )
    $policy$
  )
ON CONFLICT (name, bucket_id, operation) DO NOTHING;

-- DELETE: Agentur kann eigene CVs löschen (wenn Profil noch Eingereicht)
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES
  (
    'Agentur kann eigene CVs loeschen',
    'cv-uploads',
    'DELETE',
    $policy$
    EXISTS (
      SELECT 1 FROM kandidaten_profile kp
      WHERE kp.cv_pfad = storage.objects.name
        AND kp.agentur_id = get_my_agentur_id()
        AND kp.status = 'Eingereicht'
    )
    $policy$
  )
ON CONFLICT (name, bucket_id, operation) DO NOTHING;
