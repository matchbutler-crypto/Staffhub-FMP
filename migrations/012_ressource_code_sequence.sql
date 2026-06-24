-- migrations/012_ressource_code_sequence.sql
-- Fix ressource_code unique constraint race condition by using a sequence
-- instead of COUNT(*)+1 in the trigger function.

-- Create sequence, starting after current max numeric value in existing codes
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(REGEXP_REPLACE(ressource_code, '[^0-9]', '', 'g') AS INTEGER)),
    0
  ) INTO max_num
  FROM ressourcen
  WHERE ressource_code ~ '[0-9]+';

  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS ressource_code_seq START WITH %s', max_num + 1);

  -- Advance sequence to max if it already existed but is behind
  PERFORM setval('ressource_code_seq', GREATEST(max_num, nextval('ressource_code_seq') - 1));
END;
$$;

-- Drop and recreate as regular TEXT function (used as column DEFAULT, not a trigger)
DROP FUNCTION IF EXISTS generate_ressource_code() CASCADE;

CREATE FUNCTION generate_ressource_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'RES-' || LPAD(nextval('ressource_code_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
