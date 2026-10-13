// Skill matching.
//
// This is not a fallback. gemini-match has never successfully returned a
// result (see the jsonMatch[1] bug fixed alongside this file), so
// aiSkillMatch's catch has always handed back whatever this produces — and
// FindJobs renders it as the "% Match" badge on every job card. Every match
// score CJLink has ever shown came from in here.
//
// The old rule was substring containment in both directions:
//
//     skill.includes(req) || req.includes(skill)
//
// That is why "Java" scored against "JavaScript", why "C" scored against
// "CSS", and why an applicant listing "Customer Service Rep" scored nothing
// against a job asking for "Customer Service". It also had no way to know
// that "Good communication" and "Communication" are the same skill — which
// is what the `skills` catalog's aliases are for.
//
// Now: normalize, resolve both sides through the alias index to a canonical
// name, then compare. The containment check survives only in whole-word
// form, so a short skill can no longer match inside a longer unrelated one,
// while a longer applicant skill still matches the shorter requirement it
// contains.

const NOT_WORD = /[^a-z0-9]/;

/**
 * Lowercase, and turn anything that is not a letter, digit or one of the
 * characters that carry meaning in a skill name into a separator.
 *
 *   "Good communication!"  -> "good communication"
 *   "HTML & CSS"           -> "html css"
 *   "C++"                  -> "c++"      (kept — it is the name)
 *   "Node.js"              -> "node.js"  (kept)
 *
 * Exported because the search box and the alias index must normalize the
 * same way, or an index entry could never be found.
 */
export function normalizeSkill(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whole-word containment. Deliberately not a regex — the skill names in
 * circulation contain "+", "#", "." and "(" and every one of those is a
 * footgun inside a pattern. A manual scan with a boundary test is clearer
 * and cannot be broken by a skill name.
 */
function containsWholeWord(haystack, needle) {
  if (!haystack || !needle || needle.length > haystack.length) return false;
  // A side counts as a boundary when it is the edge of the string or a
  // character that is not part of a word. Note "" must be checked explicitly:
  // /[^a-z0-9]/ does not match the empty string.
  const isBoundary = (c) => c === "" || NOT_WORD.test(c);
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const before = at === 0 ? "" : haystack[at - 1];
    const end = at + needle.length;
    const after = end >= haystack.length ? "" : haystack[end];
    // Both sides must be boundaries, so "java" stops matching inside
    // "javascript" and "c" inside "css", while "Customer Service" still
    // matches inside "Customer Service Rep".
    if (isBoundary(before) && isBoundary(after)) return true;
    from = at + 1;
  }
}

/**
 * @param {string} applicantSkills       Comma-separated, as stored on profiles.skills.
 * @param {string[]} jobRequirements     The jobs.requirements array.
 * @param {Record<string,string>|null}   aliasIndex — normalized name or alias
 *                                       mapped to its canonical skill name.
 *                                       Optional: without it, matching still
 *                                       works, it just cannot recognise that
 *                                       "NodeJS" and "Node.js" are one skill.
 */
export function computeSkillMatch(applicantSkills, jobRequirements, aliasIndex = null) {
  const requirements = (jobRequirements || []).filter((r) => normalizeSkill(r));
  if (requirements.length === 0) {
    return { matched: 0, total: 0, score: 0, matchedItems: [], missingItems: [] };
  }

  const canonical = (value) => {
    const norm = normalizeSkill(value);
    return (aliasIndex && aliasIndex[norm]) || norm;
  };

  // Longest catalog entry first, so "computer hardware repair" wins over
  // "computer" when an applicant has written both.
  const catalogKeys = aliasIndex
    ? Object.keys(aliasIndex).filter(Boolean).sort((a, b) => b.length - a.length)
    : [];

  /**
   * An applicant's entry is very often a catalog skill inside a longer
   * phrase — "Node.js developer", "Customer Service Rep". Those are
   * hand-typed, and demanding an exact index hit would score them as
   * nothing at all. Give credit for the entry they contain instead.
   */
  const resolveApplicantSkill = (skill) => {
    const norm = normalizeSkill(skill);
    const direct = aliasIndex && aliasIndex[norm];
    if (direct) return direct;
    for (const key of catalogKeys) {
      if (containsWholeWord(norm, key)) return aliasIndex[key];
    }
    return norm;
  };

  const applicantCanonical = new Set();
  const applicantNormalized = [];
  (applicantSkills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((skill) => {
      applicantNormalized.push(normalizeSkill(skill));
      applicantCanonical.add(resolveApplicantSkill(skill));
    });

  const matchedItems = [];
  const missingItems = [];

  requirements.forEach((req) => {
    const reqNorm = normalizeSkill(req);
    const found =
      // Both sides named the same skill, possibly by different words.
      applicantCanonical.has(canonical(req)) ||
      // Or one names the other as a whole phrase: "Customer Service" inside
      // "Customer Service Rep", in either direction.
      applicantNormalized.some(
        (skill) => containsWholeWord(skill, reqNorm) || containsWholeWord(reqNorm, skill)
      );

    if (found) matchedItems.push(req.trim());
    else missingItems.push(req.trim());
  });

  return {
    matched: matchedItems.length,
    total: requirements.length,
    score: Math.round((matchedItems.length / requirements.length) * 100),
    matchedItems,
    missingItems,
  };
}
