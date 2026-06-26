-- migrations/017_fix_ressource_code_default.sql
-- Migration 012 dropped generate_ressource_code() with CASCADE, which removed
-- the column DEFAULT. The function was recreated but the DEFAULT was never
-- re-attached. This migration restores it and advances the sequence past
-- all existing RES-XXXX values to avoid unique constraint violations.

DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(REGEXP_REPLACE(ressource_code, '[^0-9]', '', 'g') AS INTEGER)),
    0
  ) INTO max_num
  FROM ressourcen
  WHERE ressource_code ~ '^RES-[0-9]+$';

  PERFORM setval('ressource_code_seq', GREATEST(max_num + 1, nextval('ressource_code_seq')));
END;
$$;

ALTER TABLE ressourcen
  ALTER COLUMN ressource_code SET DEFAULT generate_ressource_code();
