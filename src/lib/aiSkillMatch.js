import { computeSkillMatch } from "./skillMatch";
import { callEdgeFunction } from "./supabaseClient";

export async function aiSkillMatch(applicantSkills, jobRequirements, jobTitle) {
  if (!jobRequirements || jobRequirements.length === 0) {
    return { matched: 0, total: 0, score: 0, basicScore: 0, matchedItems: [], missingItems: [], explanation: "" };
  }

  const basic = computeSkillMatch(applicantSkills, jobRequirements);

  try {
    const result = await callEdgeFunction("gemini-match", {
      applicantSkills,
      jobRequirements,
      jobTitle,
    });

    const matched = result.matchedItems?.length || 0;
    const total = jobRequirements.length;

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
