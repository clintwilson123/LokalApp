-- =============================================
-- MERGE CASE-ONLY DUPLICATE SKILLS
--
-- The backfill in 20261014090000 deliberately preserved every requirement
-- string already in production so the applicant dropdown could not shrink on
-- release. Doing that surfaced the drift it was designed to expose:
-- "Customer service" and "Customer Service", "Inventory management" and
-- "Inventory Management" — separate rows, one catalog, one dropdown.
--
-- Only merges entries that are identical once normalized the same way
-- skillMatch.normalizeSkill does. That is not a judgement call, so it is safe
-- to do here. Semantic near-duplicates ("Software Skills" vs "Software
-- installation", "IT-related course") are LEFT ALONE — whether those are one
-- skill or two is the admin's call, not a script's.
--
-- Safe because nothing references skills.id: jobs.requirements is a TEXT[]
-- of names, and matching resolves names through the alias index, which
-- collapses to the surviving row's spelling anyway. A profile that saved the
-- deleted spelling keeps working.
-- =============================================

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      -- Same normalizer as the client's skillMatch.normalizeSkill: lowercase
      -- FIRST, then turn anything that is not a letter/digit/+#. into a
      -- space, collapse, trim. The order is the whole point — run the
      -- pattern over mixed case and its [^a-z0-9+#.] class consumes every
      -- capital instead of folding it, so "Customer Service" normalizes to
      -- "customer ervice" and never collides with anything. See
      -- 20261014090300, which had to re-run this after getting that wrong.
      PARTITION BY TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(LOWER(name), '[^a-z0-9+#.]+', ' ', 'g'), ' +', ' ', 'g'
      ))
      -- Prefer a categorized row over a backfilled 'General' one; then the
      -- alphabetically first, so the survivor is deterministic. Booleans sort
      -- false-first, so the test must be "is this the General row" — using
      -- `<> 'General'` ranks the backfilled row FIRST and deletes the
      -- categorized one instead, which is what the first run did.
      ORDER BY (category = 'General'), name
    ) AS rn
  FROM skills
)
DELETE FROM skills
USING ranked
WHERE skills.id = ranked.id
  AND ranked.rn > 1;

-- No VACUUM here: it cannot run inside the transaction a migration executes
-- in. Postgres autovacuums a table this size on its own.
