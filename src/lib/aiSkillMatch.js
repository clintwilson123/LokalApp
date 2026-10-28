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

  // Everything the cheap pass could answer has been answered. Sending the full
  // requirement list anyway cost a round trip to re-hear answers we already
  // had — and, because a whole-roster scan makes one call per applicant, it was
  // the single biggest reason a scan took as long as it did. No open questions,
  // no AI call, no explanation line: the score and the two lists still say
  // everything the card needs.
  const uncertain = basic.missingItems || [];
  if (uncertain.length === 0) {
    return { ...basic, basicScore: basic.score, explanation: "" };
  }

  try {
    const result = await withTimeout(
      callEdgeFunction("gemini-match", {
        applicantSkills,
        // ONLY the requirements that are still in doubt. A shorter list is a
        // shorter prompt and a shorter answer, so the calls that are actually
        // made come back faster too.
        jobRequirements: uncertain,
        jobTitle,
      }),
      AI_TIMEOUT_MS
    );

    // A local match is exact or alias-resolved, so it stands on its own; the
    // model only ever ADDS to it. It cannot talk a confidently matched
    // requirement out of the list, which is a small accuracy win on top of the
    // speed one. The Set is belt and braces: the model is only asked about the
    // misses, so an overlap means it answered about something else, and a
    // duplicate would both overcount the score and give the chip list two
    // identical keys.
    const matchedItems = [...new Set([...(basic.matchedItems || []), ...(result.matchedItems || [])])];
    const missingItems = result.missingItems || [];
    const matched = matchedItems.length;

    return {
      matched,
      total: basic.total,
      score: basic.total > 0 ? Math.round((matched / basic.total) * 100) : 0,
      basicScore: basic.score,
      matchedItems,
      missingItems,
      explanation: result.explanation || "AI match analysis complete.",
    };
  } catch {
    return { ...basic, basicScore: basic.score, explanation: "AI analysis unavailable, showing basic match." };
  }
}
