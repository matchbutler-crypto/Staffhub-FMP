-- migrations/005_zeitnachweise.sql
-- Create zeitnachweise table for Stundennachweis uploads per Beauftragung

CREATE TABLE IF NOT EXISTS zeitnachweise (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beauftragung_id UUID NOT NULL REFERENCES beauftragungen(id) ON DELETE CASCADE,
  monat           DATE NOT NULL,
  stunden_ist     NUMERIC(6, 2),
  pdf_path        TEXT NOT NULL,
  parsed_raw      JSONB,
  uploaded_by     UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (beauftragung_id, monat)
);

CREATE INDEX IF NOT EXISTS idx_zeitnachweise_beauftragung_id ON zeitnachweise(beauftragung_id);
CREATE INDEX IF NOT EXISTS idx_zeitnachweise_monat ON zeitnachweise(monat);

ALTER TABLE zeitnachweise ENABLE ROW LEVEL SECURITY;

-- Manager/Admin can read all
CREATE POLICY "Manager liest alle Zeitnachweise" ON zeitnachweise
  FOR SELECT USING (
    get_my_rolle() IN ('Admin', 'Staffhub Manager', 'Controller')
  );

-- Agentur can only read/insert for their own Beauftragungen
CREATE POLICY "Agentur liest eigene Zeitnachweise" ON zeitnachweise
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM beauftragungen b
      WHERE b.id = beauftragung_id
        AND b.agentur_id = (SELECT agentur_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Agentur legt eigene Zeitnachweise an" ON zeitnachweise
  FOR INSERT WITH CHECK (
    get_my_rolle() = 'Agentur'
    AND EXISTS (
      SELECT 1 FROM beauftragungen b
      WHERE b.id = beauftragung_id
        AND b.agentur_id = (SELECT agentur_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Manager legt Zeitnachweise an" ON zeitnachweise
  FOR INSERT WITH CHECK (
    get_my_rolle() IN ('Admin', 'Staffhub Manager')
  );

-- Storage bucket for PDFs (create in Supabase Dashboard: bucket name = "zeitnachweise", private)
