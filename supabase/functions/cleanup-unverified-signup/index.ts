import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

// =============================================
// CLEANUP-UNVERIFIED-SIGNUP Edge Function
// Removes an account that was created but whose
// verification OTP was never successfully delivered.
//
// Payload: { email }
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

    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return json({ error: "Valid email required", code: "INVALID_FORMAT" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { user, failed: lookupFailed } = await findUserByEmail(supabase, email);
    if (lookupFailed) {
      return json({ error: "Cleanup failed", code: "SERVER_ERROR" }, 500);
    }

    if (!user) {
      // Already gone — nothing to clean up
      return json({ success: true, message: "No unverified account to remove." }, 200);
    }

    // Only remove accounts that have NOT verified their email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email_verified")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.email_verified) {
      return json({
        success: false,
        error: "Account already verified.",
        code: "ALREADY_VERIFIED",
      }, 409);
    }

    // Delete verification codes first (FK-safe), then profile rows, then auth user
    await supabase.from("verification_codes").delete().eq("user_id", user.id);
    await supabase.from("notifications").delete().eq("user_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("cleanup-unverified-signup: failed to delete auth user:", deleteError);
      return json({ error: "Cleanup failed", code: "SERVER_ERROR" }, 500);
    }

    console.log("cleanup-unverified-signup: removed unverified account", { email });
    return json({ success: true, message: "Unverified account removed." }, 200);
  } catch (err) {
    console.error("cleanup-unverified-signup error:", err);
    return json({ error: "Cleanup failed", code: "SERVER_ERROR" }, 500);
  }
});
