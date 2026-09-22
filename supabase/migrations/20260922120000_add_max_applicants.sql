-- Add max_applicants to jobs (was only in supabase/fix-missing-columns.sql, never applied)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_applicants INT DEFAULT 0;
