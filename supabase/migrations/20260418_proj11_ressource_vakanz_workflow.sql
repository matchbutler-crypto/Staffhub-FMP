-- ── PROJ-11: Ressource auf Vakanz spielen + Status-Workflow ───────────────────

-- Tabelle: ressource_vakanz_links
CREATE TABLE ressource_vakanz_links (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ressource_id     UUID NOT NULL REFERENCES ressourcen(id) ON DELETE CASCADE,
  vakanz_id        UUID NOT NULL REFERENCES vakanzen_data(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'Gespielt'
                     CHECK (status IN ('Gespielt', 'Interview geplant', 'Zugesagt', 'Abgesagt', 'Abgelehnt')),
  interview_datum  DATE,
  created_by       UUID NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_active_link UNIQUE (ressource_id, vakanz_id)
);

CREATE TRIGGER set_ressource_vakanz_links_updated_at
  BEFORE UPDATE ON ressource_vakanz_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_rvl_ressource_id ON ressource_vakanz_links(ressource_id);
CREATE INDEX idx_rvl_vakanz_id    ON ressource_vakanz_links(vakanz_id);
CREATE INDEX idx_rvl_status       ON ressource_vakanz_links(status);

ALTER TABLE ressource_vakanz_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rvl_select" ON ressource_vakanz_links
  FOR SELECT USING (
    get_my_rolle() IN ('Admin', 'Staffhub Manager')
    OR ressource_id IN (
      SELECT id FROM ressourcen WHERE agentur_id = (
        SELECT agentur_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "rvl_insert" ON ressource_vakanz_links
  FOR INSERT WITH CHECK (
    get_my_rolle() IN ('Admin', 'Staffhub Manager')
  );

CREATE POLICY "rvl_update" ON ressource_vakanz_links
  FOR UPDATE USING (
    get_my_rolle() IN ('Admin', 'Staffhub Manager')
  );

-- ── Tabelle: ressource_historie ───────────────────────────────────────────────

CREATE TABLE ressource_historie (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ressource_id  UUID NOT NULL REFERENCES ressourcen(id) ON DELETE CASCADE,
  link_id       UUID REFERENCES ressource_vakanz_links(id) ON DELETE SET NULL,
  typ           TEXT NOT NULL DEFAULT 'system' CHECK (typ IN ('system', 'manuell')),
  text          TEXT NOT NULL CHECK (char_length(text) <= 500),
  erstellt_von  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rh_ressource_id ON ressource_historie(ressource_id);
CREATE INDEX idx_rh_created_at   ON ressource_historie(created_at DESC);

ALTER TABLE ressource_historie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_select" ON ressource_historie
  FOR SELECT USING (
    get_my_rolle() IN ('Admin', 'Staffhub Manager')
    OR ressource_id IN (
      SELECT id FROM ressourcen WHERE agentur_id = (
        SELECT agentur_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "rh_insert" ON ressource_historie
  FOR INSERT WITH CHECK (
    get_my_rolle() IN ('Admin', 'Staffhub Manager')
  );
