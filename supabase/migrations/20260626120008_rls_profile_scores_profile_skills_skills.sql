-- Enable RLS and add policies for skills, profile_skills, profile_scores
-- These tables were exposed without RLS — any anon key could read/write all rows.

-- ============================================================
-- skills (reference/lookup table)
-- SELECT: all roles (non-sensitive catalog data)
-- INSERT/UPDATE/DELETE: Admin + Staffhub Manager only
-- service_role always bypasses RLS (extraction pipeline unaffected)
-- ============================================================
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills_select" ON public.skills;
CREATE POLICY "skills_select"
  ON public.skills FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "skills_insert" ON public.skills;
CREATE POLICY "skills_insert"
  ON public.skills FOR INSERT
  WITH CHECK (get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text]));

DROP POLICY IF EXISTS "skills_update" ON public.skills;
CREATE POLICY "skills_update"
  ON public.skills FOR UPDATE
  USING    (get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text]))
  WITH CHECK (get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text]));

DROP POLICY IF EXISTS "skills_delete" ON public.skills;
CREATE POLICY "skills_delete"
  ON public.skills FOR DELETE
  USING (get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text]));

-- ============================================================
-- profile_skills (extracted skills per kandidaten_profile)
-- Follows same access model as kandidaten_profile:
--   Admin/Manager see all; Agency sees own profiles only (via JOIN)
-- service_role bypasses RLS (extraction pipeline writes directly)
-- ============================================================
ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_skills_select" ON public.profile_skills;
CREATE POLICY "profile_skills_select"
  ON public.profile_skills FOR SELECT
  USING (
    get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text])
    OR EXISTS (
      SELECT 1 FROM public.kandidaten_profile kp
      WHERE kp.id = profile_id
        AND kp.agentur_id = get_my_agentur_id()
    )
  );

DROP POLICY IF EXISTS "profile_skills_insert" ON public.profile_skills;
CREATE POLICY "profile_skills_insert"
  ON public.profile_skills FOR INSERT
  WITH CHECK (
    get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text])
    OR EXISTS (
      SELECT 1 FROM public.kandidaten_profile kp
      WHERE kp.id = profile_id
        AND kp.agentur_id = get_my_agentur_id()
    )
  );

DROP POLICY IF EXISTS "profile_skills_update" ON public.profile_skills;
CREATE POLICY "profile_skills_update"
  ON public.profile_skills FOR UPDATE
  USING (
    get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text])
    OR EXISTS (
      SELECT 1 FROM public.kandidaten_profile kp
      WHERE kp.id = profile_id
        AND kp.agentur_id = get_my_agentur_id()
    )
  )
  WITH CHECK (
    get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text])
    OR EXISTS (
      SELECT 1 FROM public.kandidaten_profile kp
      WHERE kp.id = profile_id
        AND kp.agentur_id = get_my_agentur_id()
    )
  );

DROP POLICY IF EXISTS "profile_skills_delete" ON public.profile_skills;
CREATE POLICY "profile_skills_delete"
  ON public.profile_skills FOR DELETE
  USING (
    get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text])
    OR EXISTS (
      SELECT 1 FROM public.kandidaten_profile kp
      WHERE kp.id = profile_id
        AND kp.agentur_id = get_my_agentur_id()
    )
  );

-- ============================================================
-- profile_scores (computed match scores, internal only)
-- Admin/Manager only — agencies have no direct need to read these
-- service_role bypasses RLS (scoring pipeline writes directly)
-- ============================================================
ALTER TABLE public.profile_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_scores_select" ON public.profile_scores;
CREATE POLICY "profile_scores_select"
  ON public.profile_scores FOR SELECT
  USING (get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text]));

DROP POLICY IF EXISTS "profile_scores_insert" ON public.profile_scores;
CREATE POLICY "profile_scores_insert"
  ON public.profile_scores FOR INSERT
  WITH CHECK (get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text]));

DROP POLICY IF EXISTS "profile_scores_update" ON public.profile_scores;
CREATE POLICY "profile_scores_update"
  ON public.profile_scores FOR UPDATE
  USING    (get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text]))
  WITH CHECK (get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text]));

DROP POLICY IF EXISTS "profile_scores_delete" ON public.profile_scores;
CREATE POLICY "profile_scores_delete"
  ON public.profile_scores FOR DELETE
  USING (get_my_rolle() = ANY(ARRAY['Admin'::text, 'Staffhub Manager'::text]));
