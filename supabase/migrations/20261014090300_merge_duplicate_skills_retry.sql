-- =============================================
-- MERGE CASE-ONLY DUPLICATE SKILLS (corrected re-run)
--
-- 20261014090200 set out to do exactly this and deleted nothing at all. Its
-- normalizing regex ran over the UN-lowercased name while the character
-- class only listed a-z, so every capital was consumed as a separator
-- instead of being folded:
--
--     "Customer service"  -> "customer service"
--     "Customer Service"  -> "customer ervice"     <- the S was eaten
--
-- No two partition keys ever collided, so `rn > 1` was never true and the
-- DELETE matched zero rows. Reported success, did nothing.
--
-- skillMatch.normalizeSkill lowercases first; this now does too. That is the
-- only change. Checked against production before running: with the corrected
-- order exactly two groups collide, both case-only —
-- "Customer Service" (Sales & Customer Service) and "Inventory Management"
-- (Office & Admin) survive, their backfilled 'General' twins go.
--
-- Idempotent: a re-run finds nothing left to merge.
-- =============================================

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(LOWER(name), '[^a-z0-9+#.]+', ' ', 'g'), ' +', ' ', 'g'
      ))
      -- Booleans sort false-first, so this must ask "is this the General
      -- row" — `<> 'General'` would rank the backfilled row first and delete
      -- the categorized one, which is how 20261014090400 came to be needed.
      ORDER BY (category = 'General'), name
    ) AS rn
  FROM skills
)
DELETE FROM skills
USING ranked
WHERE skills.id = ranked.id
  AND ranked.rn > 1;
