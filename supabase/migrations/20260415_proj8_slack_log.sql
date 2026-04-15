-- PROJ-8: Slack-Integration — Posting-Log Tabelle + slack_detail_posted_at
-- Führe diese SQL im Supabase Dashboard → SQL Editor aus.

-- 1. Neues Tracking-Feld auf vakanzen_data (echte Tabelle hinter der View "vakanzen")
ALTER TABLE vakanzen_data
  ADD COLUMN IF NOT EXISTS slack_detail_posted_at TIMESTAMPTZ;

-- 2. Neue Tabelle: slack_post_log
CREATE TABLE IF NOT EXISTS slack_post_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vakanz_id   UUID REFERENCES vakanzen_data(id) ON DELETE SET NULL,
  post_type   TEXT NOT NULL CHECK (post_type IN ('detail', 'update')),
  workspace   TEXT NOT NULL CHECK (workspace IN ('freelance', 'partner')),
  channel     TEXT NOT NULL CHECK (channel IN ('testing', 'germany', 'global')),
  status      TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_msg   TEXT,
  posted_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS aktivieren
ALTER TABLE slack_post_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Admin + Staffhub Manager können lesen und schreiben
CREATE POLICY "Manager und Admin können Slack-Logs lesen"
  ON slack_post_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rolle IN ('Admin', 'Staffhub Manager')
        AND profiles.aktiv = TRUE
    )
  );

CREATE POLICY "Manager und Admin können Slack-Logs schreiben"
  ON slack_post_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rolle IN ('Admin', 'Staffhub Manager')
        AND profiles.aktiv = TRUE
    )
  );

-- 5. Indexes für Performance
CREATE INDEX IF NOT EXISTS idx_slack_post_log_posted_at
  ON slack_post_log(posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_slack_post_log_vakanz_id
  ON slack_post_log(vakanz_id);

CREATE INDEX IF NOT EXISTS idx_slack_post_log_post_type
  ON slack_post_log(post_type);
