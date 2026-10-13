-- =============================================
-- REPAIR THE SURVIVOR CHOICE FROM 20261014090300
--
-- 20261014090300 merged the case-only duplicates, but kept the WRONG row of
-- each pair: its ORDER BY used `(category <> 'General')`, and booleans sort
-- false-first, so the un-categorized backfilled row ranked first and was
-- kept while the properly categorized one was deleted. Two skills were left
-- sitting in "General" that belong in named categories, spelled the way an
-- admin happened to type them rather than the catalog's own spelling.
--
-- Matching is unaffected either way — normalizeSkill folds both spellings to
-- the same key — so this is presentation, not correctness.
--
-- Targeted rather than rule-driven because the duplicate is already gone: a
-- generic rule cannot tell a "wrongly survived duplicate" from a backfilled
-- row that simply has no canonical counterpart, and the other 26 General
-- rows are the latter. Both statements are guarded on category = 'General',
-- so a re-run finds nothing to do.
-- =============================================

UPDATE skills
SET name = 'Customer Service', category = 'Sales & Customer Service'
WHERE name = 'Customer service' AND category = 'General';

UPDATE skills
SET name = 'Inventory Management', category = 'Office & Admin'
WHERE name = 'Inventory management' AND category = 'General';
