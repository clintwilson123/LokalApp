export function computeSkillMatch(applicantSkills, jobRequirements) {
  if (!jobRequirements || jobRequirements.length === 0) {
    return { matched: 0, total: 0, score: 0, matchedItems: [], missingItems: [] };
  }

  const skills = (applicantSkills || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const matchedItems = [];
  const missingItems = [];

  jobRequirements.forEach((req) => {
    const reqLower = req.toLowerCase().trim();
    const found = skills.some(
      (skill) => skill.includes(reqLower) || reqLower.includes(skill)
    );
    if (found) matchedItems.push(req.trim());
    else missingItems.push(req.trim());
  });

  return {
    matched: matchedItems.length,
    total: jobRequirements.length,
    score: Math.round((matchedItems.length / jobRequirements.length) * 100),
    matchedItems,
    missingItems,
  };
}
