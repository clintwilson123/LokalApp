import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

// =============================================
// SEND-VERIFICATION-CODE Edge Function
// Generates a 6-digit OTP and sends it via email
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

const DELIVERY_FAILED_ERROR =
  "This Gmail address appears to be invalid or cannot receive emails. Please use a valid Gmail account.";

function isValidGmailFormat(email: string): boolean {
  const lower = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return false;
  const [localPart, domain] = lower.split("@");
  if (!["gmail.com", "googlemail.com"].includes(domain)) return false;
  if (localPart.length < 6 || localPart.length > 64) return false;
  if (!/^[a-z0-9.]+$/.test(localPart)) return false;
  if (localPart.startsWith(".") || localPart.endsWith(".")) return false;
  if (localPart.includes("..")) return false;
  return true;
}

// Find a user by email via admin listUsers.
// supabase-js v2 has no auth.admin.getUserByEmail — listUsers is the supported API.
// Scans up to 20 pages x 100 users (2000); enough for this app's scale.
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
      return json({ error: "Please enter a valid Gmail address.", code: "INVALID_FORMAT" }, 400);
    }

    // Validate Gmail format before doing any work
    if (!isValidGmailFormat(email)) {
      console.warn("send-verification-code: invalid Gmail format", { email });
      return json({ error: "Please enter a valid Gmail address.", code: "INVALID_FORMAT" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the user by email (listUsers-based — getUserByEmail does not exist in supabase-js v2)
    const { user: authUser, failed: lookupFailed } = await findUserByEmail(supabase, email);
    if (lookupFailed) {
      console.error("send-verification-code: user lookup failed for email", { email });
      return json({ error: "Failed to send code. Please try again.", code: "SERVER_ERROR" }, 500);
    }
    if (!authUser) {
      // Don't reveal if user exists or not — but treat as delivery failure for UX
      console.warn("send-verification-code: user not found for email", { email });
      return json({
        success: false,
        error: DELIVERY_FAILED_ERROR,
        code: "DELIVERY_FAILED",
      }, 400);
    }

    const userId = authUser.id;

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing unused codes for this user
    await supabase
      .from("verification_codes")
      .delete()
      .eq("user_id", userId)
      .eq("used", false)
      .eq("purpose", "signup");

    // Insert new code (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        user_id: userId,
        code,
        purpose: "signup",
        expires_at: expiresAt,
      });

    if (insertError) {
      // Log real error for debugging — never expose internals to the client
      console.error("send-verification-code: failed to insert verification code:", insertError);
      return json({ error: "Failed to generate code. Please try again.", code: "SERVER_ERROR" }, 500);
    }

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

    if (resendKey) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "CJLink <noreply@cjlink.app>",
            to: [email],
            subject: `[CJLink] Your verification code: ${code}`,
            text: `Your CJLink verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
          }),
        });

        if (resendRes.ok) {
          emailSent = true;
        } else {
          // Log the real Resend error for debugging — redact the OTP in case
          // the API echoes the request payload back
          const resendBody = await resendRes.text().catch(() => "");
          console.error("send-verification-code: Resend API rejected email", {
            status: resendRes.status,
            email,
            body: resendBody.split(code).join("[redacted]"),
          });
          emailSent = false;
        }
      } catch (err) {
        // Network failure talking to Resend — log it, treat as delivery failure
        console.error("send-verification-code: failed to call Resend:", err);
        emailSent = false;
      }
    } else {
      // No Resend key configured — cannot actually deliver email
      console.error("send-verification-code: RESEND_API_KEY is not configured");
    }

    if (!emailSent) {
      // Clean up the unused code since delivery failed
      await supabase
        .from("verification_codes")
        .delete()
        .eq("user_id", userId)
        .eq("used", false)
        .eq("purpose", "signup");

      return json({
        success: false,
        error: DELIVERY_FAILED_ERROR,
        code: "DELIVERY_FAILED",
      }, 400);
    }

    // Also create an in-app notification — the OTP itself is only ever
    // delivered by email, never stored where the client could read it
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        message: "📧 Your CJLink verification code has been sent to your email. It expires in 10 minutes.",
        type: "verification",
      });

    return json({
      success: true,
      message: "Verification code sent",
    }, 200);
  } catch (err) {
    // Log the real error for debugging — never expose internals to the client
    console.error("send-verification-code error:", err);
    return json({ error: "Failed to send code. Please try again.", code: "SERVER_ERROR" }, 500);
  }
});
