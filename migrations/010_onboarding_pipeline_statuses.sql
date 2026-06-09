-- migrations/010_onboarding_pipeline_statuses.sql
-- Extends ressource_vakanz_links.status to allow new onboarding pipeline values.

ALTER TABLE ressource_vakanz_links
  DROP CONSTRAINT IF EXISTS ressource_vakanz_links_status_check;

ALTER TABLE ressource_vakanz_links
  ADD CONSTRAINT ressource_vakanz_links_status_check
  CHECK (status IN (
    'Gespielt',
    'Interview geplant',
    'Zugesagt',
    'Stammdaten anfordern',
    'Freelancer Prozess gestartet',
    'Einkauf gestartet',
    'Genehmigung gestartet',
    'Beauftragt',
    'Setup externe Mail & Hardware',
    'Running',
    'Abgesagt',
    'Abgelehnt',
    'Zurückgezogen'
  ));
