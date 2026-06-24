-- migrations/010_feature_toggles.sql

-- Feature-State pro Agentur (leeres Objekt = alle Features deaktiviert)
ALTER TABLE agenturen
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}';

-- Feature-Key auf bestehender release_notes-Tabelle (nullable = kein Feature-Gate)
ALTER TABLE release_notes
  ADD COLUMN IF NOT EXISTS feature_key TEXT;

-- Index für Feature-Key-Abfragen
CREATE INDEX IF NOT EXISTS idx_release_notes_feature_key
  ON release_notes(feature_key)
  WHERE feature_key IS NOT NULL;
