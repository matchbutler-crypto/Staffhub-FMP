-- Fix: vakanzen_view_insert Trigger nutzt RETURNING * INTO NEW
-- Das schlägt fehl weil vakanzen_data mehr / andere Spaltenreihenfolge hat als die VIEW
-- (branche + kunde wurden nachträglich zur Tabelle hinzugefügt).
-- Fix: nur die ID zurückgeben, alle anderen NEW-Felder bleiben wie vom User übergeben.

CREATE OR REPLACE FUNCTION vakanzen_view_insert()
RETURNS TRIGGER AS $$
DECLARE
  inserted_id uuid;
BEGIN
  INSERT INTO public.vakanzen_data (
    titel, branche, kunde, rolle, beschreibung, skills, skills_nice_have,
    erfahrungslevel, startdatum, laufzeit, teamgroesse, fte_anzahl, auslastung,
    arbeitsmodell, ansprechpartner, status, standort, budget_intern, slack_ts,
    weitere_kommentare, created_by
  ) VALUES (
    NEW.titel, NEW.branche, NEW.kunde, NEW.rolle, NEW.beschreibung,
    NEW.skills, NEW.skills_nice_have, NEW.erfahrungslevel, NEW.startdatum,
    NEW.laufzeit, NEW.teamgroesse, NEW.fte_anzahl, NEW.auslastung,
    NEW.arbeitsmodell, NEW.ansprechpartner, NEW.status, NEW.standort,
    NEW.budget_intern, NEW.slack_ts, NEW.weitere_kommentare, NEW.created_by
  ) RETURNING id INTO inserted_id;

  NEW.id := inserted_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
