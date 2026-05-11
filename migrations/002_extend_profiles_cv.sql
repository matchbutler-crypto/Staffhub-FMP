-- migrations/002_extend_profiles_cv.sql
-- Add CV storage and extracted skills to profiles table

ALTER TABLE IF EXISTS kandidaten_profile
ADD COLUMN IF NOT EXISTS cv_file_path TEXT,
ADD COLUMN IF NOT EXISTS extracted_skills TEXT[],
ADD COLUMN IF NOT EXISTS ki_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,2) DEFAULT 0.0;

CREATE INDEX idx_kandidaten_cv_path ON kandidaten_profile(cv_file_path);
CREATE INDEX idx_kandidaten_ki_score ON kandidaten_profile(ki_score);
