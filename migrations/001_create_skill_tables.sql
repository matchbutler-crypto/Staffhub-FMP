-- migrations/001_create_skill_tables.sql
-- Create skills, profile_skills, and profile_scores tables for skill extraction & matching

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  source TEXT NOT NULL DEFAULT 'onet',
  synonyms TEXT[],
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_skills_name ON skills(name);
CREATE INDEX idx_skills_name_lower ON skills(LOWER(name));
CREATE INDEX idx_skills_source ON skills(source);

CREATE TABLE IF NOT EXISTS profile_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES kandidaten_profile(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  added_by TEXT NOT NULL CHECK (added_by IN ('extraction', 'manual')),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now(),

  UNIQUE(profile_id, skill_name)
);

CREATE INDEX idx_profile_skills_profile_id ON profile_skills(profile_id);
CREATE INDEX idx_profile_skills_skill_id ON profile_skills(skill_id);
CREATE INDEX idx_profile_skills_verified ON profile_skills(verified);

CREATE TABLE IF NOT EXISTS profile_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES kandidaten_profile(id) ON DELETE CASCADE,
  vacancy_id UUID NOT NULL REFERENCES vakanzen(id) ON DELETE CASCADE,
  matched_skills_count INT NOT NULL DEFAULT 0,
  required_skills_count INT NOT NULL DEFAULT 0,
  score_percentage INT NOT NULL DEFAULT 0,
  calculated_at TIMESTAMP DEFAULT now(),

  UNIQUE(profile_id, vacancy_id)
);

CREATE INDEX idx_profile_scores_profile_id ON profile_scores(profile_id);
CREATE INDEX idx_profile_scores_vacancy_id ON profile_scores(vacancy_id);
