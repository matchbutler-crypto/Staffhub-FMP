-- migrations/016_ressourcen_agency_fields.sql
-- Add agency ownership and external reference to ressourcen table
-- Required for agency API profile upsert (POST /agency/v1.0/profiles)

ALTER TABLE ressourcen
  ADD COLUMN IF NOT EXISTS agentur_id   UUID REFERENCES agenturen(id),
  ADD COLUMN IF NOT EXISTS external_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_ressourcen_agentur_id   ON ressourcen(agentur_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ressourcen_external_ref_agentur
  ON ressourcen(agentur_id, external_ref)
  WHERE external_ref IS NOT NULL AND agentur_id IS NOT NULL;
