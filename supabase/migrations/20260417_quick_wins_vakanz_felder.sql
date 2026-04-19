-- Quick-Win Änderungen an vakanzen_data + VIEW:
-- 1. ansprechpartner optional
-- 2. laufzeit nullable + enddatum (DATE) hinzufügen
-- 3. titel nullable (wird per API auto auf rolle gesetzt)
-- 4. onsite_anteil für Hybrid-Arbeitsmodell
-- 5. budget_intern wird nun per API/Form als Pflichtfeld behandelt (EK Tagesrate)

ALTER TABLE vakanzen_data ALTER COLUMN ansprechpartner DROP NOT NULL;
ALTER TABLE vakanzen_data ALTER COLUMN laufzeit DROP NOT NULL;
ALTER TABLE vakanzen_data ALTER COLUMN titel DROP NOT NULL;
ALTER TABLE vakanzen_data ADD COLUMN IF NOT EXISTS enddatum DATE;
ALTER TABLE vakanzen_data ADD COLUMN IF NOT EXISTS onsite_anteil SMALLINT CHECK (onsite_anteil BETWEEN 0 AND 100);

-- VIEW neu aufbauen mit enddatum + onsite_anteil
DROP VIEW IF EXISTS vakanzen CASCADE;

CREATE VIEW vakanzen AS
SELECT
  id, titel, branche, kunde, rolle, beschreibung, skills, skills_nice_have,
  erfahrungslevel, startdatum, laufzeit, enddatum, teamgroesse, fte_anzahl,
  auslastung, arbeitsmodell, onsite_anteil, ansprechpartner, status, standort,
  created_at, updated_at, created_by, slack_detail_posted_at,
  CASE WHEN get_my_rolle() = ANY (ARRAY['Admin'::text,'Staffhub Manager'::text])
    THEN budget_intern ELSE NULL::numeric END AS budget_intern,
  CASE WHEN get_my_rolle() = ANY (ARRAY['Admin'::text,'Staffhub Manager'::text])
    THEN slack_ts ELSE NULL::text END AS slack_ts,
  CASE WHEN get_my_rolle() = ANY (ARRAY['Admin'::text,'Staffhub Manager'::text])
    THEN weitere_kommentare ELSE NULL::text END AS weitere_kommentare
FROM vakanzen_data;

ALTER VIEW vakanzen SET (security_invoker = true);

CREATE TRIGGER vakanzen_instead_of_insert
  INSTEAD OF INSERT ON vakanzen
  FOR EACH ROW EXECUTE FUNCTION vakanzen_view_insert();

CREATE TRIGGER vakanzen_instead_of_update
  INSTEAD OF UPDATE ON vakanzen
  FOR EACH ROW EXECUTE FUNCTION vakanzen_view_update();

CREATE TRIGGER vakanzen_instead_of_delete
  INSTEAD OF DELETE ON vakanzen
  FOR EACH ROW EXECUTE FUNCTION vakanzen_view_delete();

-- INSERT Trigger: neue Spalten enddatum + onsite_anteil
CREATE OR REPLACE FUNCTION vakanzen_view_insert()
RETURNS TRIGGER AS $$
DECLARE inserted_id uuid;
BEGIN
  INSERT INTO public.vakanzen_data (
    titel, branche, kunde, rolle, beschreibung, skills, skills_nice_have,
    erfahrungslevel, startdatum, laufzeit, enddatum, teamgroesse, fte_anzahl,
    auslastung, arbeitsmodell, onsite_anteil, ansprechpartner, status, standort,
    budget_intern, slack_ts, weitere_kommentare, created_by
  ) VALUES (
    NEW.titel, NEW.branche, NEW.kunde, NEW.rolle, NEW.beschreibung,
    NEW.skills, NEW.skills_nice_have, NEW.erfahrungslevel, NEW.startdatum,
    NEW.laufzeit, NEW.enddatum, NEW.teamgroesse, NEW.fte_anzahl,
    NEW.auslastung, NEW.arbeitsmodell, NEW.onsite_anteil, NEW.ansprechpartner,
    NEW.status, NEW.standort,
    NEW.budget_intern, NEW.slack_ts, NEW.weitere_kommentare, NEW.created_by
  ) RETURNING id INTO inserted_id;
  NEW.id := inserted_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- UPDATE Trigger: neue Spalten enddatum + onsite_anteil
CREATE OR REPLACE FUNCTION vakanzen_view_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.vakanzen_data SET
    titel              = NEW.titel,
    branche            = NEW.branche,
    kunde              = NEW.kunde,
    rolle              = NEW.rolle,
    beschreibung       = NEW.beschreibung,
    skills             = NEW.skills,
    skills_nice_have   = NEW.skills_nice_have,
    erfahrungslevel    = NEW.erfahrungslevel,
    startdatum         = NEW.startdatum,
    laufzeit           = NEW.laufzeit,
    enddatum           = NEW.enddatum,
    teamgroesse        = NEW.teamgroesse,
    fte_anzahl         = NEW.fte_anzahl,
    auslastung         = NEW.auslastung,
    arbeitsmodell      = NEW.arbeitsmodell,
    onsite_anteil      = NEW.onsite_anteil,
    ansprechpartner    = NEW.ansprechpartner,
    status             = NEW.status,
    standort           = NEW.standort,
    budget_intern      = NEW.budget_intern,
    slack_ts           = NEW.slack_ts,
    weitere_kommentare = NEW.weitere_kommentare
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
