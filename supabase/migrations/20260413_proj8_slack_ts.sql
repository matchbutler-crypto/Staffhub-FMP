-- PROJ-8: Slack-Integration — slack_ts Spalte auf vakanzen
-- Führe diese SQL im Supabase Dashboard → SQL Editor aus.

ALTER TABLE vakanzen
  ADD COLUMN IF NOT EXISTS slack_ts TEXT;
