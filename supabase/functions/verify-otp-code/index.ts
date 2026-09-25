import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

// =============================================
// VERIFY-OTP-CODE Edge Function
// Verifies the 6-digit OTP and marks email as verified
//
// Payload: { email, code }
// =============================================

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

// Wrong guesses allowed before the code is invalidated (brute-force protection)
const MAX_ATTEMPTS = 5;

// One message for every bad outcome — wrong, expired, exhausted, or an
// unknown email must be indistinguishable to an attacker.
const GENERIC_CODE_ERROR = "Invalid or expired verification code.";

// Find a user by email via admin listUsers.
// supabase-js v2 has no auth.admin.getUserByEmail — listUsers is the supported API.
async function findUserByEmail(
  supabase: any,
  email: string
): Promise<{ user: any | null; failed: boolean }> {
  const target = email.toLowerCase().trim();
  let page = 1;
  const perPage = 100;

  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("findUserByEmail: listUsers failed:", error);
      return { user: null, failed: true };
    }
    const users = data?.users || [];
    const match = users.find((u: any) => (u.email || "").toLowerCase() === target);
    if (match) return { user: match, failed: false };
    if (users.length < perPage) break;
    page++;
  }

  return { user: null, failed: false };
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
    }

    const { email, code } = await req.json();

    if (!email || !code) {
      return json({ error: "Email and code are required", code: "MISSING_FIELDS" }, 400);
    }

    if (typeof code !== "string" || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return json({ error: "Code must be 6 digits", code: "INVALID_CODE" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the user by email (listUsers-based — getUserByEmail does not exist in supabase-js v2)
    const { user: authUser, failed: lookupFailed } = await findUserByEmail(supabase, email);
    if (lookupFailed) {
      return json({ error: "Verification failed. Please try again.", code: "SERVER_ERROR" }, 500);
    }
    if (!authUser) {
      // Same generic answer as a wrong code — do not reveal whether the email exists
      return json({ error: GENERIC_CODE_ERROR, code: "INVALID_CODE" }, 400);
    }

    const userId = authUser.id;

    // Latest unused code — looked up WITHOUT the submitted value so failed
    // attempts can be counted before the comparison
    const { data: codeRecord } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("purpose", "signup")
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!codeRecord) {
      return json({ error: GENERIC_CODE_ERROR, code: "INVALID_CODE" }, 400);
    }

    // Brute-force protection: a code that already hit the limit is dead
    const attempts = codeRecord.attempts ?? 0;
    if (attempts >= MAX_ATTEMPTS) {
      await supabase
        .from("verification_codes")
        .update({ used: true })
        .eq("id", codeRecord.id)
        .eq("used", false);
      return json({ error: GENERIC_CODE_ERROR, code: "INVALID_CODE" }, 400);
    }

    // Check expiry — same generic message as a wrong code
    if (new Date(codeRecord.expires_at) < new Date()) {
      return json({ error: GENERIC_CODE_ERROR, code: "INVALID_CODE" }, 400);
    }

    if (codeRecord.code !== code) {
      const nextAttempts = attempts + 1;
      await supabase
        .from("verification_codes")
        .update({ attempts: nextAttempts, used: nextAttempts >= MAX_ATTEMPTS })
        .eq("id", codeRecord.id);
      return json({ error: GENERIC_CODE_ERROR, code: "INVALID_CODE" }, 400);
    }

    // Mark code as used
    await supabase
      .from("verification_codes")
      .update({ used: true })
      .eq("id", codeRecord.id);

    // Mark email as verified in profiles
    await supabase
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", userId);

    // Also confirm the email in auth.users
    await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    // Create success notification
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        message: "✅ Your email has been verified! You can now access all features.",
        type: "info",
      });

    return json({ success: true, message: "Email verified successfully" }, 200);
  } catch (err) {
    // Log the real error for debugging — never expose internals to the client
    console.error("verify-otp-code error:", err);
    return json({ error: "Verification failed. Please try again.", code: "SERVER_ERROR" }, 500);
  }
});
