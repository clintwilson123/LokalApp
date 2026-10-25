import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

// `gemini-2.0-flash` was retired by Google (404 on generateContent), which
// silently broke this function before. The `-latest` alias tracks the current
// stable Lite model, so a future retirement can't take it down again. Lite is
// also what this job needs: the plain `flash-latest` endpoint was timing out /
// 503-ing under load, while Lite answers this classification prompt in ~50
// tokens with the full JSON intact.
const MODEL = "gemini-flash-lite-latest";

// Browser callers (aiSkillMatch via supabase.functions.invoke) need CORS, and
// the OPTIONS preflight below, or the request never reaches the handler.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ---- Admin gate -------------------------------------------------------
    // Every real caller is an admin page (ManageJobs, AdminApplicants), and
    // supabase-js attaches the signed-in user's JWT automatically. Without
    // this check anyone holding the public project URL could POST in a loop
    // and burn the Gemini quota — `verify_jwt` alone does not help, because
    // the anon key shipped in the browser bundle is itself a valid JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: callerData, error: callerError } = await supabase.auth.getUser(token);
    const caller = callerData?.user;
    if (callerError || !caller) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return json({ error: "Admin access required" }, 403);
    }
    // ----------------------------------------------------------------------

    const { applicantSkills, jobRequirements, jobTitle } = await req.json();

    if (!jobRequirements || jobRequirements.length === 0) {
      return json({ error: "No job requirements provided" }, 400);
    }

    const API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!API_KEY) {
      return json({ error: "Gemini API key not configured" }, 500);
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
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        // Header instead of `?key=` so the key never lands in a URL, a log
        // line, or an error message.
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            // The old 512 cap was sized for a non-thinking model. Lite answers
            // in ~50 tokens, but keep generous headroom so a longer skill list
            // can never truncate the JSON mid-string (finishReason MAX_TOKENS
            // meant `match(/\{[\s\S]*\}/)` found nothing and the parse failed).
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return json({ error: "Gemini API error", details: errText }, 502);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // `match()` with no capture group returns only the full match at [0].
    // This read [1], which is undefined for a pattern with no group — so
    // JSON.parse threw, the catch below returned 500, callEdgeFunction threw,
    // and aiSkillMatch's catch silently fell back to computeSkillMatch. The
    // AI ranking had never once produced a result.
    //
    // The regex is greedy, so it spans first "{" to last "}" and excludes any
    // markdown fences around it.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return json({ error: "Failed to parse Gemini response" }, 500);
    }

    const result = JSON.parse(jsonMatch[0]);
    return json(result, 200);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
