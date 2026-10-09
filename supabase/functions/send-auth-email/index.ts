import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Webhook } from "npm:standardwebhooks@1.0.0";

// =============================================
// SEND-AUTH-EMAIL Edge Function
// The handler for Supabase's "Send Email" Auth Hook (Dashboard:
// Authentication → Hooks). GoTrue's default mailer is replaced entirely
// while this hook is enabled, so every auth email flows through here:
//
//   * signup / reauthentication .... 6-digit code ({{code}} template)
//   * recovery / magiclink / invite  link built from token_hash
//   * email_change .................. link (current -> token, new -> token_new)
//   * *_notification ............... informational note, no code, no token
//
// Called ONLY by Supabase Auth with a standardWebhooks-signed payload:
//
//   * signature verified before the payload is parsed (401 otherwise),
//   * non-POST rejected (400), no CORS surface at all,
//   * unknown email_action_type acknowledged with 200 but suppressed —
//     never guess a template for an action we do not model,
//   * every redirect resolved against APP_SITE_URL only,
//   * EmailJS failure -> plain 500 with no retry hint, so GoTrue does not
//     retry (it only retries rate-limit/unavailable responses) and the
//     user never receives a duplicate,
//   * no token, code, secret or payload value is ever logged.
// =============================================

type MailSpec = {
  templateId: string;
  params: Record<string, string>;
};

// Actions delivered as a six-digit code ({{code}} template).
const CODE_ACTIONS = new Set(["signup", "reauthentication"]);

// Actions delivered as a clickable verify link ({{link}} template).
const LINK_ACTIONS = new Set(["recovery", "magiclink", "invite"]);

const SITE_NAME = "CJLink";

const CODE_TEXTS: Record<string, { subject: string; purpose: string }> = {
  signup: {
    subject: "Your CJLink verification code",
    purpose: "Enter this code to confirm your email address.",
  },
  reauthentication: {
    subject: "Your CJLink sign-in code",
    purpose: "Enter this code to confirm it is you signing in.",
  },
};

const LINK_TEXTS: Record<
  string,
  { subject: string; heading: string; message: string; buttonText: string }
> = {
  recovery: {
    subject: "Reset your CJLink password",
    heading: "Reset your password",
    message:
      "Use the button below to choose a new password for your CJLink account. If you did not request this, you can safely ignore this email.",
    buttonText: "Reset password",
  },
  magiclink: {
    subject: "Your CJLink sign-in link",
    heading: "Sign in to CJLink",
    message:
      "Use the button below to finish signing in. If you did not request this, you can safely ignore this email.",
    buttonText: "Sign in",
  },
  invite: {
    subject: "You have been invited to CJLink",
    heading: "Join CJLink",
    message:
      "Use the button below to accept your invitation and set up your account. If you were not expecting this, you can safely ignore this email.",
    buttonText: "Accept invitation",
  },
  email_change: {
    subject: "Confirm your new CJLink email address",
    heading: "Confirm your new email",
    message:
      "Use the button below to confirm this address for your CJLink account. If you did not request this change, contact the administrator.",
    buttonText: "Confirm email",
  },
};

// Account notifications carry no code and no token — just the note and a
// way back to the app. Unknown/unsupported action types are suppressed by
// the caller instead of being forced through one of these.
const NOTICE_TEXTS: Record<string, { subject: string; heading: string; message: string }> = {
  password_changed: {
    subject: "Your CJLink password was changed",
    heading: "Password changed",
    message:
      "The password for your CJLink account was just changed. If this was not you, reset your password immediately.",
  },
  email_changed: {
    subject: "Your CJLink email address was changed",
    heading: "Email changed",
    message:
      "The email address on your CJLink account was just changed. If this was not you, contact the administrator.",
  },
  phone_changed: {
    subject: "Your CJLink account was updated",
    heading: "Account updated",
    message: "The phone number on your CJLink account was just changed.",
  },
  identity_linked: {
    subject: "Your CJLink account was updated",
    heading: "Account updated",
    message: "A sign-in method was linked to your CJLink account.",
  },
  identity_unlinked: {
    subject: "Your CJLink account was updated",
    heading: "Account updated",
    message: "A sign-in method was unlinked from your CJLink account.",
  },
  mfa_enrolled: {
    subject: "Your CJLink account was updated",
    heading: "Account updated",
    message: "A new two-factor sign-in method was added to your CJLink account.",
  },
  mfa_unenrolled: {
    subject: "Your CJLink account was updated",
    heading: "Account updated",
    message: "A two-factor sign-in method was removed from your CJLink account.",
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  return Deno.env.get(name) || "";
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The ONLY address a verify link may ever point at: APP_SITE_URL itself,
 * or a path on it (that is how /update-password gets in). Anything off-site
 * — absolute or protocol-relative — collapses back to the site root, and
 * GoTrue re-validates the final value against its own Redirect URL list.
 */
function trustedRedirect(raw: unknown, appSiteUrl: string): string {
  try {
    const base = new URL(appSiteUrl);
    const target = new URL(str(raw), base);
    if (target.origin !== base.origin) return appSiteUrl;
    return target.toString();
  } catch {
    return appSiteUrl;
  }
}

// GoTrue's verify endpoint validates the hash server-side and then
// redirects the browser to the (already restricted) target.
function verifyUrl(tokenHash: string, type: string, redirectTo: string, supabaseUrl: string): string {
  const url = new URL("/auth/v1/verify", supabaseUrl);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 400);
    }

    const secret = env("SEND_EMAIL_HOOK_SECRET");
    if (!secret) {
      console.error("send-auth-email: SEND_EMAIL_HOOK_SECRET is not configured");
      return json({ error: "Webhook secret not configured" }, 500);
    }

    // Raw body first: the signature covers the exact bytes.
    const payload = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    try {
      new Webhook(secret).verify(payload, headers);
    } catch {
      return new Response("Invalid signature", { status: 401 });
    }

    let event: { user?: Record<string, unknown>; email_data?: Record<string, unknown> };
    try {
      event = JSON.parse(payload);
    } catch {
      return json({ error: "Invalid payload" }, 400);
    }

    const emailData = event.email_data || {};
    const action = str(emailData.email_action_type);
    const toEmail = str(emailData.email).trim();
    const appSiteUrl = env("APP_SITE_URL");
    const supabaseUrl = env("SUPABASE_URL");
    const templateCode = env("EMAILJS_TEMPLATE_ID");
    const templateAccount = env("EMAILJS_TEMPLATE_ACCOUNT_ID");

    // Route the action to a concrete template spec — or suppress it.
    let spec: MailSpec | null = null;

    if (CODE_ACTIONS.has(action)) {
      const texts = CODE_TEXTS[action];
      const code = str(emailData.token);
      if (!texts || !/^[0-9]{6}$/.test(code)) {
        console.error("send-auth-email: code action without a usable code", { action });
        return json({ error: "Email payload missing code" }, 500);
      }
      spec = {
        templateId: templateCode,
        params: {
          to_email: toEmail,
          email: toEmail,
          subject: texts.subject,
          code,
          purpose: texts.purpose,
          site_name: SITE_NAME,
        },
      };
    } else if (LINK_ACTIONS.has(action)) {
      const texts = LINK_TEXTS[action];
      const tokenHash = str(emailData.token_hash);
      if (!texts || !tokenHash) {
        console.error("send-auth-email: link action without a usable token hash", { action });
        return json({ error: "Email payload missing token" }, 500);
      }
      spec = {
        templateId: templateAccount,
        params: {
          to_email: toEmail,
          email: toEmail,
          subject: texts.subject,
          heading: texts.heading,
          message: texts.message,
          button_text: texts.buttonText,
          button_url: verifyUrl(
            tokenHash,
            action,
            trustedRedirect(emailData.redirect_to, appSiteUrl),
            supabaseUrl,
          ),
          site_name: SITE_NAME,
        },
      };
    } else if (action === "email_change") {
      // One payload covers this recipient only: the current address
      // confirms with the old token, the new address with token_new.
      // Never guess — a hash that does not match this recipient is not sent.
      const newAddress = str(emailData.new_email).toLowerCase();
      const useNewToken = Boolean(newAddress) && toEmail.toLowerCase() === newAddress;
      const tokenHash = str(useNewToken ? emailData.token_hash_new : emailData.token_hash);
      const texts = LINK_TEXTS.email_change;
      if (!tokenHash) {
        console.error("send-auth-email: email_change without a token hash for the recipient");
        return json({ error: "Email payload missing token" }, 500);
      }
      spec = {
        templateId: templateAccount,
        params: {
          to_email: toEmail,
          email: toEmail,
          subject: texts.subject,
          heading: texts.heading,
          message: texts.message,
          button_text: texts.buttonText,
          button_url: verifyUrl(
            tokenHash,
            "email_change",
            trustedRedirect(emailData.redirect_to, appSiteUrl),
            supabaseUrl,
          ),
          site_name: SITE_NAME,
        },
      };
    } else if (NOTICE_TEXTS[action]) {
      const texts = NOTICE_TEXTS[action];
      spec = {
        templateId: templateAccount,
        params: {
          to_email: toEmail,
          email: toEmail,
          subject: texts.subject,
          heading: texts.heading,
          message: texts.message,
          button_text: "Open CJLink",
          button_url: appSiteUrl,
          site_name: SITE_NAME,
        },
      };
    } else {
      // Unknown or deliberately unsupported action (phone, MFA variants we
      // do not model, future GoTrue additions): acknowledge so GoTrue stops,
      // but suppress the email — never guess a template.
      console.warn("send-auth-email: suppressed unknown email action", { action });
      return new Response(null, { status: 200 });
    }

    const serviceId = env("EMAILJS_SERVICE_ID");
    const publicKey = env("EMAILJS_PUBLIC_KEY");
    if (
      !toEmail || !appSiteUrl || !supabaseUrl ||
      !serviceId || !publicKey ||
      !templateCode || !templateAccount || !spec
    ) {
      console.error("send-auth-email: required configuration is missing", { action });
      return json({ error: "Email service is not configured" }, 500);
    }

    let emailRes: Response;
    try {
      emailRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: spec.templateId,
          user_id: publicKey,
          template_params: spec.params,
        }),
      });
    } catch {
      console.error("send-auth-email: EmailJS unreachable", { action });
      return json({ error: "Failed to send email" }, 500);
    }

    if (!emailRes.ok) {
      // Status and action ONLY: an EmailJS error body can echo the request
      // back, and that request carries the code or the token hash.
      console.error("send-auth-email: EmailJS rejected the send", { action, status: emailRes.status });
      // Plain 500 with no retry hint: GoTrue only retries rate-limit and
      // unavailable responses, so this failure surfaces once and the user
      // never receives a duplicate email.
      return json({ error: "Failed to send email" }, 500);
    }

    return json({ success: true }, 200);
  } catch {
    // Never the error's message: it could carry payload content.
    console.error("send-auth-email: unhandled failure");
    return json({ error: "Internal error" }, 500);
  }
});
