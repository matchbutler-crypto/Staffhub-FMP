-- migrations/020_fix_ressource_code_setval.sql
-- Three issues found:
-- 1. assign_ressource_code() still uses unqualified 'ressource_code_seq' — migration 018
--    intended to fix this but the DB function was never updated. Under Supabase's
--    search_path, this resolves to a different sequence than public.ressource_code_seq,
--    generating stale/duplicate codes.
-- 2. Two redundant BEFORE INSERT triggers on ressourcen (set_ressource_code_trigger +
--    trg_assign_ressource_code) both try to assign ressource_code — confusing and fragile.
-- 3. Migration 018's setval used REGEXP_REPLACE('[^0-9]','') which extracts embedded
--    digits from the D3XP prefix (D3XP0060 → 30060), potentially jumping the sequence
--    past existing RES-XXXX codes and causing collisions.

-- Fix 1: Use SUBSTRING to extract ONLY trailing digits (RES-3007 → 3007, D3XP0060 → 60)
DO $$
DECLARE
  max_num INTEGER;
  cur_val BIGINT;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(ressource_code FROM '[0-9]+$') AS INTEGER)),
    0
  ) INTO max_num
  FROM ressourcen
  WHERE ressource_code ~ '[0-9]+$';

  SELECT last_value INTO cur_val FROM public.ressource_code_seq;

  PERFORM setval(
    'public.ressource_code_seq',
    GREATEST(max_num + 1, cur_val)
  );
END;
$$;

-- Fix 2: Drop the redundant trg_assign_ressource_code trigger —
-- set_ressource_code_trigger already handles this via generate_ressource_code()
DROP TRIGGER IF EXISTS trg_assign_ressource_code ON ressourcen;

-- Fix 3: Update assign_ressource_code() to use qualified sequence
-- (keep function for safety in case trigger is re-added elsewhere)
CREATE OR REPLACE FUNCTION assign_ressource_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ressource_code IS NULL THEN
    NEW.ressource_code := generate_ressource_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure column DEFAULT is set (may have been dropped by earlier CASCADE in migration 012)
ALTER TABLE ressourcen
  ALTER COLUMN ressource_code SET DEFAULT generate_ressource_code();
