-- Add tage_ist_override column and make pdf_path nullable for manual entries
ALTER TABLE zeitnachweise
  ADD COLUMN IF NOT EXISTS tage_ist_override INTEGER,
  ALTER COLUMN pdf_path DROP NOT NULL;
