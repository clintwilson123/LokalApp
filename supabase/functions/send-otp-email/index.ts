import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

/**
 * Supabase Auth Hook — 6-digit OTP Email via EmailJS
 *
 * Handles: signup, reauthentication (OTP actions)
 * Suppresses: recovery, magiclink, invite, email_change (link actions)
 *
 * Required Environment Variables (set via `supabase secrets set`):
 *   - EMAILJS_SERVICE_ID
 *   - EMAILJS_TEMPLATE_ID
 *   - EMAILJS_PUBLIC_KEY
 */

interface EmailJSRequest {
  service_id: string;
  template_id: string;
  user_id: string;
  template_params: {
    code: string;
    email: string;
    to_email: string;
    purpose: string;
    site_name: string;
  };
}

interface SupabaseHookPayload {
  user?: { email?: string } | null;
  email_data?: {
    email?: string;
    email_action_type?: string;
    token?: string;
    otp?: string;
  };
}

const SITE_NAME = "CJLink";

const PURPOSE_BY_ACTION: Record<string, string> = {
  signup: "Enter this code to confirm your email address.",
  reauthentication: "Enter this code to confirm it is you signing in.",
};

const OTP_ACTIONS = new Set(["signup", "reauthentication"]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function extractEmail(payload: SupabaseHookPayload): string | null {
  // Priority: email_data.email → user.email
  return payload.email_data?.email?.trim() ?? payload.user?.email?.trim() ?? null;
}

function extractOtp(payload: SupabaseHookPayload): string | null {
  // Priority: email_data.token → email_data.otp
  return payload.email_data?.token?.trim() ?? payload.email_data?.otp?.trim() ?? null;
}

function isValidOtp(otp: string | null): otp is string {
  return typeof otp === "string" && /^\d{6}$/.test(otp);
}

serve(async (req: Request): Promise<Response> => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Load required configuration
    const serviceId = getRequiredEnv("EMAILJS_SERVICE_ID");
    const templateId = getRequiredEnv("EMAILJS_TEMPLATE_ID");
    const publicKey = getRequiredEnv("EMAILJS_PUBLIC_KEY");

    // Parse Supabase Auth Hook payload
    const payload: SupabaseHookPayload = await req.json();

    const action = payload.email_data?.email_action_type?.trim() ?? "";
    const email = extractEmail(payload);
    const otp = extractOtp(payload);

    // Only handle OTP-based actions
    if (!OTP_ACTIONS.has(action)) {
      // Gracefully suppress link-based actions (recovery, magiclink, invite, email_change)
      return new Response(null, { status: 200 });
    }

    // Validate required fields
    if (!email) {
      console.error("send-otp-email: missing recipient email", { action });
      return jsonResponse({ error: "Missing recipient email" }, 500);
    }

    if (!isValidOtp(otp)) {
      console.error("send-otp-email: missing or invalid 6-digit OTP", { action, otp });
      return jsonResponse({ error: "Email payload missing valid 6-digit code" }, 500);
    }

    // Build EmailJS request
    const emailJsPayload: EmailJSRequest = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        code: otp,
        email,
        to_email: email,
        purpose: PURPOSE_BY_ACTION[action] ?? "Enter the verification code to proceed.",
        site_name: SITE_NAME,
      },
    };

    // Send via EmailJS REST API
    const emailJsResponse = await fetch(
      "https://api.emailjs.com/api/v1.0/email/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailJsPayload),
      }
    );

    if (!emailJsResponse.ok) {
      const errorBody = await emailJsResponse.text().catch(() => "");
      console.error("send-otp-email: EmailJS rejected the send", {
        action,
        status: emailJsResponse.status,
        body: errorBody,
      });
      return jsonResponse({ error: "Failed to send email via EmailJS" }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    // Never leak sensitive payload data in logs
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("send-otp-email: unhandled failure", message);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});