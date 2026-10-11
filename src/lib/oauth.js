// Google (OAuth) sign-in helpers.
//
// Only PUBLIC configuration lives here: the provider name and the redirect
// target. The Google client ID / client secret belong in the Supabase
// Dashboard -> Authentication -> Providers -> Google and must never appear in
// a VITE_ variable, in this file, or in the browser bundle.

import { OAUTH_CALLBACK_PATH } from "./authFlow";

/**
 * Where Supabase Auth sends the browser back to after Google.
 *
 * Local dev links back to the running app (http://localhost:5173); production
 * builds use VITE_SITE_URL (canonical domain) or the current origin — the
 * same rule the password-reset link already uses, so both flows agree on the
 * origin. The result must ALSO be listed in Dashboard -> Authentication ->
 * URL Configuration -> Redirect URLs, or Google refuses the round-trip.
 *
 * `intent` is optional and only ever the literal "signup": it rides as a
 * query parameter so /auth/callback can tell "I started this from the Signup
 * page, prefill the form" apart from a plain sign-in. The OAuth state and
 * token exchange never depend on it.
 */
export function oauthRedirectTo(intent) {
  const isLocalhost =
    import.meta.env.DEV ||
    (typeof window !== "undefined" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname));

  let base;
  if (isLocalhost) {
    base = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  } else {
    base = import.meta.env.VITE_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
  }
  const path =
    intent === "signup" ? `${OAUTH_CALLBACK_PATH}?intent=signup` : OAUTH_CALLBACK_PATH;
  return `${String(base).replace(/\/+$/, "")}${path}`;
}

/**
 * Read the optional hand-off intent back off the callback URL.
 *
 * Only "signup" is meaningful (the Signup page started this round-trip and
 * wants the form prefilled). Anything else — including a missing or
 * hand-edited value — is treated as a plain sign-in, so a crafted link can
 * never route a signed-in user into the completion form by surprise.
 */
export function oauthIntentFromSearch(search) {
  try {
    const params = new URLSearchParams(typeof search === "string" ? search : "");
    return params.get("intent") === "signup" ? "signup" : "";
  } catch {
    return "";
  }
}

/**
 * Did the person cancel on Google's own consent screen?
 *
 * Google answers a cancelled sign-in with error=access_denied (and a
 * description mentioning the denial). That is NOT a failure of the app or the
 * provider configuration, so it gets its own calm wording instead of the
 * generic "could not sign in" error.
 */
export function isCancelledOAuth(parsed) {
  if (!parsed || parsed.kind !== "error") return false;
  const code = String(parsed.code || "").toLowerCase();
  const desc = String(parsed.description || "").toLowerCase();
  return (
    code === "access_denied" ||
    code === "cancelled" ||
    code === "canceled" ||
    desc.includes("denied") ||
    desc.includes("cancel")
  );
}
