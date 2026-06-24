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

-- Drop and recreate generate_ressource_code (can't CREATE OR REPLACE if return type changed)
DROP FUNCTION IF EXISTS generate_ressource_code() CASCADE;

CREATE FUNCTION generate_ressource_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ressource_code IS NULL THEN
    NEW.ressource_code := 'RES-' || LPAD(nextval('ressource_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger (CASCADE dropped it)
DROP TRIGGER IF EXISTS trg_generate_ressource_code ON ressourcen;
CREATE TRIGGER trg_generate_ressource_code
  BEFORE INSERT ON ressourcen
  FOR EACH ROW EXECUTE FUNCTION generate_ressource_code();
