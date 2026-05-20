-- migrations/006_beauftragungen_pool_fields.sql
-- Add pool resource fields to beauftragungen (for pool-based Beauftragungen via ressource_vakanz_links)

ALTER TABLE beauftragungen
  ADD COLUMN IF NOT EXISTS ressource_link_id UUID REFERENCES ressource_vakanz_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS erfahrungslevel_pool TEXT,
  ADD COLUMN IF NOT EXISTS ressource_name TEXT;

CREATE INDEX IF NOT EXISTS idx_beauftragungen_ressource_link_id ON beauftragungen(ressource_link_id);
