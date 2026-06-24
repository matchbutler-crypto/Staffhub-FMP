-- Retroaktiv: Ressourcen mit aktivem Zugesagt-Link auf "Nicht verfügbar" setzen
-- und verfuegbar_ab auf das Enddatum der jeweiligen Vakanz.
-- Gilt nur wenn die Ressource noch nicht bereits auf "Nicht verfügbar" steht.
-- Bei mehreren Zugesagt-Links: Vakanz mit dem spätesten Enddatum gewinnt.

UPDATE ressourcen r
SET
  verfuegbarkeit = 'Nicht verfügbar',
  verfuegbar_ab  = sub.enddatum,
  updated_at     = now()
FROM (
  SELECT DISTINCT ON (rvl.ressource_id)
    rvl.ressource_id,
    v.enddatum
  FROM ressource_vakanz_links rvl
  JOIN vakanzen v ON v.id = rvl.vakanz_id
  WHERE rvl.status = 'Zugesagt'
    AND v.enddatum IS NOT NULL
  ORDER BY rvl.ressource_id, v.enddatum DESC
) sub
WHERE r.id = sub.ressource_id
  AND r.verfuegbarkeit <> 'Nicht verfügbar';
