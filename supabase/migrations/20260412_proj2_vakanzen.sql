-- PROJ-2: vakanzen updated_at + Trigger + Indizes
-- Tabellen vakanzen, kandidaten_profile + RLS wurden bereits in der Initial-Migration angelegt.
-- Diese Migration ergänzt nur das fehlende updated_at-Feld.

ALTER TABLE vakanzen ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vakanzen_updated_at ON vakanzen;
CREATE TRIGGER vakanzen_updated_at
  BEFORE UPDATE ON vakanzen
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_vakanzen_status     ON vakanzen(status);
CREATE INDEX IF NOT EXISTS idx_vakanzen_created_at ON vakanzen(created_at DESC);
