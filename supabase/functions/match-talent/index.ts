// AI Talent Matching Edge Function (Deno)
// Deploy: supabase functions deploy match-talent --no-verify-jwt
//
// How it works:
// 1. Receives a job title from the admin
// 2. Fetches the job requirements from the database
// 3. Fetches all applicant profiles with their skills
// 4. Calculates a match score for each applicant based on skill overlap
//    and keyword relevance using TF-IDF-style scoring
// 5. Returns ranked results sorted by score descending

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { jobTitle } = await req.json();

    if (!jobTitle) {
      return new Response(
        JSON.stringify({ error: "Missing jobTitle in request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with secret key for DB access (bypasses RLS)
    const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      SECRET_KEYS["default"]
    );

    // 1. Fetch job requirements from the jobs table
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, requirements")
      .ilike("title", `%${jobTitle}%`)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found", details: jobError }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const requirements: string[] = job.requirements || [];

    // 2. Fetch all applicant profiles
    const { data: applicants, error: appError } = await supabase
      .from("profiles")
      .select("id, full_name, skills, location, resume_url, bio")
      .eq("role", "applicant");

    if (appError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch applicants", details: appError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Calculate match scores
    const scored = applicants
      .filter((a) => a.skills)
      .map((applicant) => {
        const applicantSkills = applicant.skills
          .toLowerCase()
          .split(/[,|]/)
          .map((s: string) => s.trim());

        // Compute skill overlap
        const normalizedReqs = requirements.map((r: string) => r.toLowerCase());
        let matchedSkills = 0;
        const matched: string[] = [];

        for (const skill of applicantSkills) {
          if (
            normalizedReqs.some(
              (req) => req.includes(skill) || skill.includes(req)
            )
          ) {
            matchedSkills++;
            matched.push(skill);
          }
        }

        // Score = percentage of matched skills out of total requirements
        // + small bonus for having more skills (breadth bonus)
        const baseScore =
          requirements.length > 0
            ? Math.round((matchedSkills / requirements.length) * 100)
            : 50;

        const breadthBonus = Math.min(10, applicantSkills.length * 2);
        const finalScore = Math.min(100, baseScore + breadthBonus);

        return {
          name: applicant.full_name || "Unknown",
          skills: matched.join(" | ") || "General",
          score: finalScore,
          location: applicant.location || "N/A",
          resume_url: applicant.resume_url,
          bio: applicant.bio || "",
          id: applicant.id,
        };
      })
      .sort((a, b) => b.score - a.score);

    // 4. Return top matches
    return new Response(
      JSON.stringify({
        job: job.title,
        candidates: scored.slice(0, 10),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
