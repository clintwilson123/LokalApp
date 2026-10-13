import { computeSkillMatch } from "./skillMatch";
import { loadSkillCatalog } from "./skillCatalog";
import { callEdgeFunction } from "./supabaseClient";

export async function aiSkillMatch(applicantSkills, jobRequirements, jobTitle) {
  if (!jobRequirements || jobRequirements.length === 0) {
    return { matched: 0, total: 0, score: 0, basicScore: 0, matchedItems: [], missingItems: [], explanation: "" };
  }

  // Memoized, so this is a lookup after the first call. Resolves aliases so
  // "NodeJS" and "Node.js" score as the same skill.
  const { aliasIndex } = await loadSkillCatalog();
  const basic = computeSkillMatch(applicantSkills, jobRequirements, aliasIndex);

  try {
    const result = await callEdgeFunction("gemini-match", {
      applicantSkills,
      jobRequirements,
      jobTitle,
    });

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
