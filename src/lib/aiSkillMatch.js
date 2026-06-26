const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = "gemini-2.0-flash";

export async function aiSkillMatch(applicantSkills, jobRequirements, jobTitle) {
  if (!jobRequirements || jobRequirements.length === 0) {
    return { matched: 0, total: 0, score: 0, basicScore: 0, matchedItems: [], missingItems: [], explanation: "" };
  }

  const { computeSkillMatch } = await import("./skillMatch");
  const basic = computeSkillMatch(applicantSkills, jobRequirements);

  if (!API_KEY) {
    return { ...basic, basicScore: basic.score, explanation: "Basic keyword matching (no AI key configured)" };
  }

  const skills = (applicantSkills || "").split(",").map((s) => s.trim()).filter(Boolean);

  const prompt = `You are a hiring assistant. Compare the applicant's skills against the job requirements for "${jobTitle}".

Applicant Skills: ${skills.join(", ") || "None listed"}
Job Requirements: ${jobRequirements.join(", ")}

For each requirement, determine if the applicant's skills match. Consider synonyms, related skills, and partial matches (e.g., "communication" matches "good communication skills", "CS" matches "customer service").

Return ONLY valid JSON (no markdown, no code blocks):
{
  "matchedItems": ["requirement1", "requirement2"],
  "missingItems": ["requirement3"],
  "explanation": "Brief 1-sentence reasoning for the match"
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
      }
    );

    if (!res.ok) {
      const { computeSkillMatch } = await import("./skillMatch");
      return computeSkillMatch(applicantSkills, jobRequirements);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const { computeSkillMatch } = await import("./skillMatch");
      return computeSkillMatch(applicantSkills, jobRequirements);
    }

    const result = JSON.parse(jsonMatch[1]);
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
