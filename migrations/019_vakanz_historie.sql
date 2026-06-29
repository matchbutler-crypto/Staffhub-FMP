-- migrations/019_vakanz_historie.sql

CREATE TABLE IF NOT EXISTS vakanz_historie (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vakanz_id    UUID        NOT NULL REFERENCES vakanzen_data(id) ON DELETE CASCADE,
  text         TEXT        NOT NULL,
  typ          TEXT        NOT NULL DEFAULT 'system'
                           CHECK (typ IN ('system', 'manuell')),
  erstellt_von UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vakanz_historie ENABLE ROW LEVEL SECURITY;

-- Keine INSERT-Policy: Writes erfolgen ausschließlich via Admin-Client (service_role),
-- der RLS bypassed. Direktes Schreiben durch normale User ist nicht vorgesehen.
CREATE POLICY "Admin liest vakanz_historie"
  ON vakanz_historie FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND rolle = 'Admin'
        AND aktiv = true
    )
  );

CREATE INDEX IF NOT EXISTS vakanz_historie_vakanz_id_idx
  ON vakanz_historie(vakanz_id);

CREATE INDEX IF NOT EXISTS vakanz_historie_created_at_idx
  ON vakanz_historie(created_at DESC);
