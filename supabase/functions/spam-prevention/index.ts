import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

// Gmail domain validation
function isValidGmailDomain(domain: string): boolean {
  return ["gmail.com", "googlemail.com"].includes(domain.toLowerCase());
}

// Gmail local part validation
function validateGmailLocal(localPart: string): { valid: boolean; reason?: string; code?: string } {
  const invalidFormat = (reason: string) => ({ valid: false, reason: "Please enter a valid Gmail address.", code: "INVALID_FORMAT" });

  if (localPart.length < 6) return invalidFormat("Gmail username must be at least 6 characters.");
  if (localPart.length > 64) return invalidFormat("Gmail username cannot exceed 64 characters.");
  if (!/^[a-z0-9.]+$/.test(localPart)) return invalidFormat("Gmail username contains invalid characters.");
  if (localPart.startsWith(".") || localPart.endsWith(".")) return invalidFormat("Gmail username cannot start or end with a dot.");
  if (localPart.includes("..")) return invalidFormat("Gmail username cannot contain consecutive dots.");

  const roleAccounts = ["admin", "support", "info", "noreply", "no-reply", "help", "contact", "webmaster", "postmaster", "hostmaster", "abuse", "security", "billing", "sales", "marketing", "hr", "team", "office", "mail", "service"];
  if (roleAccounts.includes(localPart)) return invalidFormat("This appears to be a role-based email address.");

  const blockedPatterns = ["test", "example", "demo", "sample", "fake", "spam", "temp", "throwaway", "trash", "disposable", "guerrilla", "mailinator", "yopmail", "tempmail", "10minutemail", "guerrillamail"];
  if (blockedPatterns.some((p) => localPart.startsWith(p))) return invalidFormat("This appears to be a test or disposable email address.");

  return { valid: true };
}

// Calculate risk score for Gmail address
function calculateGmailRisk(localPart: string): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];
  const stripped = localPart.replace(/\./g, "");

  // Excessive numbers: more than 50% digits
  const digitCount = (stripped.match(/[0-9]/g) || []).length;
  if (stripped.length > 0 && digitCount / stripped.length > 0.5) {
    score += 1;
    flags.push("excessive_numbers");
  }

  // Random pattern: alternating letters and numbers
  if (/[a-z]\d[a-z]\d[a-z]\d/.test(stripped)) {
    score += 1;
    flags.push("random_pattern");
  }

  // Very long username
  if (stripped.length > 20) {
    score += 1;
    flags.push("long_username");
  }

  // All same character repeated
  if (stripped.length >= 6 && new Set(stripped.split("")).size === 1) {
    score += 1;
    flags.push("repeated_chars");
  }

  // Low character diversity (e.g., "sadasdsadsadsadsa")
  if (stripped.length >= 10 && new Set(stripped.split("")).size / stripped.length < 0.35) {
    score += 2;
    flags.push("low_diversity");
  }

  // Sequential characters
  if (stripped.length >= 5) {
    let asc = true, desc = true;
    for (let i = 1; i < stripped.length; i++) {
      if (stripped.charCodeAt(i) !== stripped.charCodeAt(i - 1) + 1) asc = false;
      if (stripped.charCodeAt(i) !== stripped.charCodeAt(i - 1) - 1) desc = false;
    }
    if (asc || desc) {
      score += 1;
      flags.push("sequential_chars");
    }
  }

  return { score, flags };
}

// Find existing account by exact email or Gmail dot-alias via admin listUsers.
// supabase-js v2 has no auth.admin.getUserByEmail — listUsers is the supported API.
// Scans up to 20 pages x 100 users (2000); enough for this app's scale.
async function scanForExistingGmail(
  supabase: any,
  email: string
): Promise<{ exact: boolean; alias: boolean; failed: boolean }> {
  const target = email.toLowerCase().trim();
  const [targetLocal, targetDomain] = target.split("@");
  const targetStripped = targetLocal.replace(/\./g, "");
  const targetIsGmail = targetDomain === "gmail.com" || targetDomain === "googlemail.com";

  let page = 1;
  const perPage = 100;
  let exact = false;
  let alias = false;

  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("scanForExistingGmail: listUsers failed:", error);
      return { exact: false, alias: false, failed: true };
    }
    const users = data?.users || [];
    for (const u of users) {
      const e = (u.email || "").toLowerCase();
      if (!e.includes("@")) continue;
      const [local, domain] = e.split("@");
      if (e === target) exact = true;
      const isGmailDomain = domain === "gmail.com" || domain === "googlemail.com";
      if (
        targetIsGmail && isGmailDomain &&
        local.replace(/\./g, "") === targetStripped
      ) {
        alias = true;
      }
    }
    if (exact && alias) break;
    if (users.length < perPage) break;
    page++;
  }

  return { exact, alias, failed: false };
}

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
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
    }

    const { email, captchaToken } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return json({ error: "Please enter a valid Gmail address.", code: "INVALID_FORMAT" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- GMAIL DOMAIN VALIDATION ---
    const [localPart, domain] = email.toLowerCase().split("@");

    if (!isValidGmailDomain(domain)) {
      return json({
        success: false,
        error: "Please enter a valid Gmail address.",
        code: "INVALID_FORMAT",
        risk_level: "high",
        checks: { gmail_domain: "fail" },
      }, 400);
    }

    // --- GMAIL LOCAL PART VALIDATION ---
    const localValidation = validateGmailLocal(localPart);
    if (!localValidation.valid) {
      return json({
        success: false,
        error: localValidation.reason,
        code: localValidation.code || "INVALID_FORMAT",
        risk_level: "high",
        checks: { gmail_domain: "pass", gmail_format: "fail" },
      }, 400);
    }

    // --- EXISTING ACCOUNT / GMAIL ALIAS DUPLICATE CHECK ---
    // One listUsers scan covers exact match and Gmail dot-aliases.
    // On lookup failure we fail-open: signUp will still reject exact duplicates later.
    const scan = await scanForExistingGmail(supabase, email);
    if (!scan.failed && scan.exact) {
      return json({
        success: false,
        error: "This email is already registered. Try signing in instead.",
        code: "ALREADY_REGISTERED",
        risk_level: "high",
        checks: { gmail_domain: "pass", gmail_format: "pass", alias_duplicate: "fail" },
      }, 409);
    }
    if (!scan.failed && scan.alias) {
      return json({
        success: false,
        error: "An account with this Gmail address already exists (Gmail dots are ignored).",
        code: "ALREADY_REGISTERED",
        risk_level: "high",
        checks: { gmail_domain: "pass", gmail_format: "pass", alias_duplicate: "fail" },
      }, 409);
    }

    // --- RISK ANALYSIS ---
    const { score: riskScore, flags } = calculateGmailRisk(localPart);

    // Strong undeliverable signals — block before account creation
    const strongUndeliverable = flags.includes("low_diversity")
      || flags.includes("repeated_chars")
      || flags.includes("sequential_chars")
      || riskScore >= 3;
    if (strongUndeliverable) {
      console.warn("spam-prevention: blocked undeliverable/risk email", {
        email,
        flags,
        riskScore,
      });
      return json({
        success: false,
        error: "This Gmail address appears to be invalid or cannot receive emails. Please use a valid Gmail account.",
        code: "UNDELIVERABLE",
        risk_level: "high",
        checks: {
          gmail_domain: "pass",
          gmail_format: "pass",
          alias_duplicate: "pass",
          risk_analysis: "fail",
        },
        flags,
      }, 400);
    }

    let riskLevel: string;
    if (riskScore >= 1) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }

    // --- CAPTCHA VERIFICATION (optional if not configured) ---
    const recaptchaSecret = Deno.env.get("SUPABASE_FUNCTIONS_RECAPTCHA_SECRET");

    if (captchaToken && recaptchaSecret) {
      try {
        const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `secret=${recaptchaSecret}&response=${captchaToken}`,
        });

        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (!verifyData.success) {
            return json({ error: "CAPTCHA verification failed. Please try again.", code: "CAPTCHA_FAILED" }, 403);
          }
          if (verifyData.score !== undefined && verifyData.score < 0.5) {
            return json({ error: "Suspicious activity detected. Please try again later.", code: "SUSPICIOUS" }, 403);
          }
        }
      } catch (captchaErr) {
        // Log real captcha error; do not block signup on captcha network issues
        console.error("spam-prevention: captcha verification error:", captchaErr);
      }
    }

    // --- RATE LIMITING ---
    const { data: recentProfiles } = await supabase
      .from("profiles")
      .select("id")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (recentProfiles && recentProfiles.length > 50) {
      return json({
        success: false,
        error: "Too many signups recently. Please try again later.",
        code: "RATE_LIMITED",
      }, 429);
    }

    // --- BLOCK HIGH RISK ---
    if (riskLevel === "high") {
      return json({
        success: false,
        error: "Registration blocked due to suspicious activity. Please try a different email address.",
        code: "HIGH_RISK",
        risk_level: riskLevel,
        checks: {
          gmail_domain: "pass",
          gmail_format: "pass",
          alias_duplicate: "pass",
          risk_analysis: "fail",
        },
        flags,
      }, 400);
    }

    return json({
      success: true,
      risk_level: riskLevel,
      checks: {
        gmail_domain: "pass",
        gmail_format: "pass",
        alias_duplicate: "pass",
        risk_analysis: riskLevel === "low" ? "pass" : "flag",
      },
      flags: flags.length > 0 ? flags : undefined,
    }, 200);
  } catch (err) {
    // Log the real error for debugging — never expose internals to the client
    console.error("spam-prevention error:", err);
    return json({ error: "Security check failed. Please try again.", code: "SERVER_ERROR" }, 500);
  }
});
