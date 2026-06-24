-- migrations/015_agency_api.sql
-- Extends external_api_keys with agentur_id scope
-- Extends agenturen with agency webhook config

ALTER TABLE external_api_keys
  ADD COLUMN IF NOT EXISTS agentur_id UUID REFERENCES agenturen(id);

ALTER TABLE agenturen
  ADD COLUMN IF NOT EXISTS agency_webhook_url    TEXT,
  ADD COLUMN IF NOT EXISTS agency_webhook_secret TEXT;

-- created_by in ressource_vakanz_links muss nullable sein für API-Einsatz
ALTER TABLE ressource_vakanz_links
  ALTER COLUMN created_by DROP NOT NULL;
