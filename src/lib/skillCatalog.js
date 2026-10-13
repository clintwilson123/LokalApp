import { supabase } from "./supabaseClient";
import { normalizeSkill } from "./skillMatch";

// The `skills` catalog, loaded once and shared by:
//   - the SkillPicker on Profile and ManageJobs (the options list)
//   - computeSkillMatch, via the alias index it resolves names through
//
// Memoized at module level because FindJobs renders a match badge per card
// and must never refetch per render.
//
// Deliberate fallback: if `skills` errors or comes back empty — which is what
// a frontend deployed ahead of its migration looks like — the vocabulary is
// derived from jobs.requirements instead, exactly as Profile did before.
// The picker is never empty and no deploy order can break skill entry.

let resolved = null;
let pending = null;

function build(rows) {
  const aliasIndex = {};

  // Names first, so a skill's own name always wins its own spelling.
  rows.forEach((row) => {
    const n = normalizeSkill(row.name);
    if (n) aliasIndex[n] = row.name;
  });
  // Then aliases, first-writer-wins, so two skills cannot claim the same one.
  rows.forEach((row) => {
    (row.aliases || []).forEach((alias) => {
      const n = normalizeSkill(alias);
      if (n && !(n in aliasIndex)) aliasIndex[n] = row.name;
    });
  });

  const byCategory = new Map();
  rows.forEach((row) => {
    const category = row.category || "General";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(row.name);
  });

  return {
    options: rows.map((row) => row.name),
    grouped: [...byCategory.entries()]
      .map(([category, skills]) => ({ category, skills: skills.sort() }))
      .sort((a, b) => a.category.localeCompare(b.category)),
    aliasIndex,
  };
}

async function fetchFromJobs() {
  const { data } = await supabase.from("jobs").select("requirements");
  const distinct = new Set();
  (data || []).forEach((job) =>
    (job.requirements || []).forEach((r) => {
      const name = (r || "").trim();
      if (name) distinct.add(name);
    })
  );
  return build(
    [...distinct].sort().map((name) => ({ name, category: "General", aliases: [] }))
  );
}

export function loadSkillCatalog() {
  if (resolved) return Promise.resolve(resolved);
  if (pending) return pending;

  pending = supabase
    .from("skills")
    .select("name, category, aliases")
    .then(async ({ data, error }) => {
      if (error || !data || data.length === 0) return fetchFromJobs();
      return build(data);
    })
    .catch(() => fetchFromJobs())
    .then((catalog) => {
      resolved = catalog;
      return catalog;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}

/** Test hook — drops the memo so each test starts from a clean cache. */
export function resetSkillCatalog() {
  resolved = null;
  pending = null;
}
