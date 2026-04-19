-- VIEW neu aufbauen mit slack_detail_posted_at.
-- slack_detail_posted_at wurde in PROJ-8 zur vakanzen_data-Tabelle hinzugefügt,
-- aber nicht in die VIEW übernommen → GET /api/vakanzen warf 500.
-- DROP CASCADE entfernt die INSTEAD OF Trigger; werden anschließend neu angelegt.

DROP VIEW IF EXISTS vakanzen CASCADE;

CREATE VIEW vakanzen AS
SELECT
  id,
  titel,
  branche,
  kunde,
  rolle,
  beschreibung,
  skills,
  skills_nice_have,
  erfahrungslevel,
  startdatum,
  laufzeit,
  teamgroesse,
  fte_anzahl,
  auslastung,
  arbeitsmodell,
  ansprechpartner,
  status,
  standort,
  created_at,
  updated_at,
  created_by,
  slack_detail_posted_at,
  CASE
    WHEN get_my_rolle() = ANY (ARRAY['Admin'::text, 'Staffhub Manager'::text]) THEN budget_intern
    ELSE NULL::numeric
  END AS budget_intern,
  CASE
    WHEN get_my_rolle() = ANY (ARRAY['Admin'::text, 'Staffhub Manager'::text]) THEN slack_ts
    ELSE NULL::text
  END AS slack_ts,
  CASE
    WHEN get_my_rolle() = ANY (ARRAY['Admin'::text, 'Staffhub Manager'::text]) THEN weitere_kommentare
    ELSE NULL::text
  END AS weitere_kommentare
FROM vakanzen_data;

-- INSTEAD OF Trigger neu anlegen
CREATE TRIGGER vakanzen_instead_of_insert
  INSTEAD OF INSERT ON vakanzen
  FOR EACH ROW EXECUTE FUNCTION vakanzen_view_insert();

CREATE TRIGGER vakanzen_instead_of_update
  INSTEAD OF UPDATE ON vakanzen
  FOR EACH ROW EXECUTE FUNCTION vakanzen_view_update();

CREATE TRIGGER vakanzen_instead_of_delete
  INSTEAD OF DELETE ON vakanzen
  FOR EACH ROW EXECUTE FUNCTION vakanzen_view_delete();

-- RLS auf der VIEW aktivieren
ALTER VIEW vakanzen SET (security_invoker = true);
