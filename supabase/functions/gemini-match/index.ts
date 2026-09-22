import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const MODEL = "gemini-2.0-flash";

serve(async (req) => {
  try {
    const { applicantSkills, jobRequirements, jobTitle } = await req.json();

    if (!jobRequirements || jobRequirements.length === 0) {
      return new Response(
        JSON.stringify({ error: "No job requirements provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!API_KEY) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const skills = (applicantSkills || "").split(",").map((s: string) => s.trim()).filter(Boolean);

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
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: "Gemini API error", details: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Failed to parse Gemini response" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(jsonMatch[1]);
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
