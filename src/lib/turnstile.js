// Cloudflare Turnstile helpers shared by every screen that must obtain a
// CAPTCHA token before calling Supabase Auth.
//
// Why four screens: GoTrue mounts captcha verification as route middleware on
// /signup, /token (password grant), /recover and /resend, so signup, login,
// forgot-password and the confirmation resend all need a token once CAPTCHA
// protection is enabled in the Dashboard. Refresh grants are exempt, so
// existing sessions keep working.
//
// Only the PUBLIC site key ever lives here. The Secret Key belongs exclusively
// in Supabase Dashboard -> Authentication -> Bot and Abuse Protection and must
// never appear in a VITE_ variable, in this file, or in the browser bundle.

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** Public site key from the Vite env. Empty means "not configured". */
export function getTurnstileSiteKey() {
  return (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
}

/**
 * Whether CAPTCHA is configured for this build.
 *
 * Callers fail closed when this is false in production: an unconfigured build
 * must never silently skip CAPTCHA just because the widget could not render.
 */
export function isTurnstileConfigured() {
  return getTurnstileSiteKey().length > 0;
}

let scriptPromise = null;

/** Load the official Turnstile script once per page load. */
export function loadTurnstileScript() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Turnstile requires a browser environment"));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const fail = () => {
      scriptPromise = null;
      reject(new Error("Failed to load the Turnstile script"));
    };
    const settle = () => {
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };

    const existing = document.querySelector("script[data-cjlink-turnstile]");
    if (existing) {
      existing.addEventListener("load", settle);
      existing.addEventListener("error", fail);
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-cjlink-turnstile", "");
    script.addEventListener("load", settle);
    script.addEventListener("error", fail);
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Render a widget into `container`.
 *
 * Returns a promise for a handle with:
 *   getToken()  — current token, or "" when there is none (missing/expired)
 *   reset()     — clear the token and render a fresh challenge
 *   remove()    — tear the widget down (used on unmount)
 *
 * Tokens are single-use and expire after 5 minutes; an expired token is
 * cleared, `onExpired` fires so the page can tell the user, and the challenge
 * is re-rendered immediately so a submit can never send a stale token to
 * Supabase Auth.
 */
export function renderTurnstile(container, { onTokenChange, onExpired } = {}) {
  if (!container) return Promise.reject(new Error("Missing Turnstile container"));

  return loadTurnstileScript().then((turnstile) => {
    let token = "";
    const notify = (value) => {
      token = value;
      if (typeof onTokenChange === "function") onTokenChange(value);
    };

    const widgetId = turnstile.render(container, {
      sitekey: getTurnstileSiteKey(),
      callback: (value) => notify(String(value || "")),
      "expired-callback": () => {
        notify("");
        if (typeof onExpired === "function") onExpired();
        try {
          turnstile.reset(widgetId);
        } catch {
          // Widget already torn down — nothing to reset.
        }
      },
      // Returning false keeps the widget's own error surface visible; the
      // token stays empty, so the submit gate blocks with a clear message.
      "error-callback": () => {
        notify("");
        return false;
      },
    });

    return {
      getToken: () => token,
      reset: () => {
        notify("");
        try {
          turnstile.reset(widgetId);
        } catch {
          // Widget already torn down.
        }
      },
      remove: () => {
        try {
          turnstile.remove(widgetId);
        } catch {
          // Widget already torn down.
        }
      },
    };
  });
}
