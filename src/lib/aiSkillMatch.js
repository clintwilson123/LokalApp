import { computeSkillMatch } from "./skillMatch";
import { loadSkillCatalog } from "./skillCatalog";
import { callEdgeFunction } from "./supabaseClient";

// A stalled request used to freeze the entire scan: the loop awaited it with
// no ceiling, so one hung call kept the spinner going for as long as the
// network felt like it — I measured a 60s hang and several 503s while the
// model was overloaded. Race the call against a timer; the catch below already
// falls back to the local matcher, so a timeout degrades the answer instead of
// hanging the page. 12s is ~30x the normal 0.4s round trip.
const AI_TIMEOUT_MS = 12000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI match timed out after ${ms}ms`)), ms);
  });
  // Clear the timer whichever way the race settles, or the test runner (and
  // any long-lived tab) keeps a pending handle around after every call.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}


export async function aiSkillMatch(applicantSkills, jobRequirements, jobTitle) {
  if (!jobRequirements || jobRequirements.length === 0) {
    return { matched: 0, total: 0, score: 0, basicScore: 0, matchedItems: [], missingItems: [], explanation: "" };
  }

  // Memoized, so this is a lookup after the first call. Resolves aliases so
  // "NodeJS" and "Node.js" score as the same skill.
  const { aliasIndex } = await loadSkillCatalog();
  const basic = computeSkillMatch(applicantSkills, jobRequirements, aliasIndex);

  try {
    const result = await withTimeout(
      callEdgeFunction("gemini-match", {
        applicantSkills,
        jobRequirements,
        jobTitle,
      }),
      AI_TIMEOUT_MS
    );

    const matched = result.matchedItems?.length || 0;
    // From the basic pass, not from jobRequirements.length — computeSkillMatch
    // drops empty strings, and the two would otherwise disagree.
    const total = basic.total;

    return {
      matched,
      total,
      score: total > 0 ? Math.round((matched / total) * 100) : 0,
      basicScore: basic.score,
      matchedItems: result.matchedItems || [],
      missingItems: result.missingItems || [],
      explanation: result.explanation || "AI match analysis complete.",
    };
  } catch {
    return { ...basic, basicScore: basic.score, explanation: "AI analysis unavailable, showing basic match." };
  }
}
