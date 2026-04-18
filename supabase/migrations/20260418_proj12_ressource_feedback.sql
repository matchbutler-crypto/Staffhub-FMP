-- ── PROJ-12: Ressourcen-Feedback ─────────────────────────────────────────────

CREATE TABLE ressource_feedback (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ressource_id UUID NOT NULL REFERENCES ressourcen(id) ON DELETE CASCADE,
  text         TEXT NOT NULL CHECK (char_length(text) >= 1 AND char_length(text) <= 2000),
  bewertung    SMALLINT CHECK (bewertung BETWEEN 1 AND 5),
  vakanz_id    UUID REFERENCES vakanzen_data(id) ON DELETE SET NULL,
  erstellt_von UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ressource_feedback ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ressource_feedback_ressource_id ON ressource_feedback(ressource_id);
CREATE INDEX idx_ressource_feedback_erstellt_von ON ressource_feedback(erstellt_von);

-- SELECT: Manager/Admin sehen alles; Agentur nur Feedback zu eigenen Ressourcen
CREATE POLICY "feedback_select" ON ressource_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.aktiv = true
        AND (
          p.rolle IN ('Admin', 'Staffhub Manager')
          OR (
            p.rolle = 'Agentur'
            AND EXISTS (
              SELECT 1 FROM ressourcen r
              WHERE r.id = ressource_feedback.ressource_id
                AND r.agentur_id = p.agentur_id
            )
          )
        )
    )
  );

-- INSERT: Manager/Admin und Agentur (nur für eigene Ressourcen)
CREATE POLICY "feedback_insert" ON ressource_feedback
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.aktiv = true
        AND (
          p.rolle IN ('Admin', 'Staffhub Manager')
          OR (
            p.rolle = 'Agentur'
            AND EXISTS (
              SELECT 1 FROM ressourcen r
              WHERE r.id = ressource_feedback.ressource_id
                AND r.agentur_id = p.agentur_id
            )
          )
        )
    )
    AND erstellt_von = auth.uid()
  );

-- DELETE: nur Verfasser
CREATE POLICY "feedback_delete" ON ressource_feedback
  FOR DELETE USING (erstellt_von = auth.uid());
