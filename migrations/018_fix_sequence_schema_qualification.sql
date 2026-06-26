-- migrations/018_fix_sequence_schema_qualification.sql
-- generate_ressource_code() and assign_ressource_code() used unqualified
-- 'ressource_code_seq' — under Supabase's search_path this resolved to a
-- different sequence context than the public one, generating stale/duplicate
-- codes. Qualify with public. and advance the sequence past existing codes.

CREATE OR REPLACE FUNCTION generate_ressource_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'RES-' || LPAD(nextval('public.ressource_code_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_ressource_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ressource_code IS NULL THEN
    NEW.ressource_code := 'D3XP' || LPAD(nextval('public.ressource_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Advance sequence safely past all existing numeric codes
SELECT setval(
  'public.ressource_code_seq',
  GREATEST(
    10000,
    COALESCE(MAX(CAST(REGEXP_REPLACE(ressource_code, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1
  )
) FROM ressourcen WHERE ressource_code ~ '[0-9]+';
