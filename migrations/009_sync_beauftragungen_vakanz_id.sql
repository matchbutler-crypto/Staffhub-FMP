-- migrations/009_sync_beauftragungen_vakanz_id.sql
-- Sync missing vakanz_id in beauftragungen table

-- For pool beauftragungen: get vakanz_id from ressource_vakanz_links
UPDATE beauftragungen
SET vakanz_id = (
  SELECT vakanz_id FROM ressource_vakanz_links
  WHERE ressource_vakanz_links.id = beauftragungen.ressource_link_id
)
WHERE vakanz_id IS NULL AND ressource_link_id IS NOT NULL;

-- For CV profile beauftragungen: get vakanz_id from kandidaten_profile
UPDATE beauftragungen
SET vakanz_id = (
  SELECT vakanz_id FROM kandidaten_profile
  WHERE kandidaten_profile.id = beauftragungen.profil_id
)
WHERE vakanz_id IS NULL AND profil_id IS NOT NULL;
