-- =============================================
-- JOB STATUS
--
-- Before this, the only way to take a job down was DELETE — and
-- applications.job_id is ON DELETE CASCADE, so deleting a job silently
-- destroyed every application, score and interview against it. There was no
-- way to close a posting without erasing its history.
--
-- Default 'published' so every existing job stays live on release; nothing
-- disappears.
-- =============================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

-- Named constraints get dropped and re-added: ALTER TABLE ... ADD CONSTRAINT
-- has no IF NOT EXISTS in Postgres.
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('draft', 'published', 'closed'));

COMMENT ON COLUMN jobs.status IS
  'draft = hidden from applicants, published = live, closed = hidden but the application history is kept.';

-- The one query FindJobs runs on every page load.
CREATE INDEX IF NOT EXISTS jobs_status_created_at_idx
  ON jobs (status, created_at DESC);
