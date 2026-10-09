// What arrived on the Site URL after a Supabase confirmation link was clicked.
//
// Supabase Auth (auth-js) parses this fragment itself when detectSessionInUrl
// is on — but it only ever acts on a SUCCESS: the tokens are stored and the
// fragment is removed from the URL. An error fragment (expired, reused or
// malformed link) is returned as an error to whoever called initialize(), and
// in this app nobody does, so it was silently dropped: the user sat on "/"
// with no explanation. These helpers give App.jsx one pure place to classify
// what arrived, decide what the user should see, and clear the fragment.
//
// Deliberately free of React and Supabase imports so the rules can be unit
// tested in isolation (mirrors authFlow.js).

import { AUTH_MSG, messageForCode } from "./authErrors";

/**
 * Read the confirmed identity out of an access token payload.
 *
 * Only decoding — never verification: the signature is checked by Supabase
 * before a session is ever created, and these values are used solely to say
 * WHICH account this callback belongs to (id) and WHICH address to name in a
 * notice (email) — never to authenticate anyone. Base64url → base64 padding
 * fixes included.
 */
function payloadFromToken(token) {
  const parts = String(token).split(".");
  if (parts.length < 2) return { sub: "", email: "" };
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return {
      sub: typeof payload.sub === "string" ? payload.sub.trim() : "",
      email: typeof payload.email === "string" ? payload.email.trim() : "",
    };
  } catch {
    return { sub: "", email: "" };
  }
}

/**
 * Classify a URL hash fragment from the confirmation redirect.
 *
 *   kind: "success"  tokens present — Supabase Auth has (or tried to take)
 *                    the session; `type` says which flow sent it. `sub`,
 *                    `email` and `accessToken` come straight from the
 *                    fragment so the caller can prove which session (if any)
 *                    THIS callback created.
 *   kind: "error"    error / error_code / error_description present — the
 *                    link failed and the user must be told.
 *   kind: "none"     nothing recognizable — ordinary visit, leave alone.
 *
 * Always returns the full shape so callers never guard missing fields.
 * The token values are never logged — only compared, then dropped.
 */
export function parseAuthCallback(rawHash) {
  const none = {
    kind: "none",
    code: "",
    description: "",
    type: "",
    sub: "",
    email: "",
    accessToken: "",
  };
  const raw = typeof rawHash === "string" ? rawHash : "";
  const fragment = raw.startsWith("#") ? raw.slice(1) : raw;
  if (!fragment.trim()) return none;

  const params = new URLSearchParams(fragment);
  const type = (params.get("type") || "").trim();

  const accessToken = params.get("access_token");
  if (accessToken) {
    const { sub, email } = payloadFromToken(accessToken);
    return {
      kind: "success",
      code: "",
      description: "",
      type,
      sub,
      email,
      accessToken,
    };
  }

  // GoTrue writes both `error` (e.g. access_denied) and the more specific
  // `error_code` (e.g. otp_expired); the code wins when both are present.
  const code = (params.get("error_code") || params.get("error") || "").trim();
  const description = (params.get("error_description") || "").trim();
  if (code || description) {
    return { kind: "error", code, description, type, sub: "", email: "", accessToken: "" };
  }

  return none;
}

/**
 * Is this success fragment one of OUR email confirmations?
 *
 * Signup confirmation (type=signup, or an untyped fragment from older
 * templates) is handled here. Password recovery and every other flow own
 * their own pages — /update-password must never be intercepted by the
 * confirmation handoff, so a recovery success is reported as "not ours".
 */
export function isConfirmationCallback(parsed) {
  if (!parsed || parsed.kind !== "success") return false;
  const type = (parsed.type || "").toLowerCase();
  return type === "" || type === "signup" || type === "confirmation";
}

/**
 * The one message a failed confirmation link ever shows.
 *
 * Known Supabase Auth codes keep the shared wording through messageForCode;
 * anything unrecognized — or no detail at all — still says the LINK failed,
 * never a generic "Something went wrong" and never raw server text.
 */
export function callbackErrorMessage(parsed) {
  const code = typeof parsed?.code === "string" ? parsed.code : "";
  const mapped = messageForCode(code, "");
  return mapped === AUTH_MSG.generic ? AUTH_MSG.linkInvalidOrExpired : mapped;
}

/**
 * Remove the callback fragment from the address bar without navigating.
 *
 * Runs for errors (auth-js leaves those in the URL, so a reload would keep
 * re-triggering the failure) and belt-and-braces for successes where the
 * token exchange failed before auth-js could clear it — tokens never stay
 * visible in the bar.
 */
export function clearCallbackHash() {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search
    );
  } catch {
    // History API unavailable — the fragment stays, nothing else breaks.
  }
}

/**
 * How long waitForCallbackSession waits for the session THIS callback
 * creates before giving up.
 *
 * auth-js stores that session only after its own network round-trip
 * (/user) succeeds, so the wait has to outlive a slow mobile connection.
 * Giving up never signs anything out — it only stops waiting, which is
 * always the safe direction.
 */
export const CONFIRMATION_SETTLE_MS = 15000;

/**
 * Is this storage session the one THIS confirmation fragment created?
 *
 * Both halves are required, and email is deliberately not one of them:
 *
 *   * user id equals the `sub` inside the fragment's access token — the
 *     account the link confirmed;
 *   * the stored access token is byte-for-byte the fragment's token —
 *     proof the session came from this callback's exchange, not from an
 *     unrelated password sign-in or a leftover session of the same user.
 *
 * Nothing here authenticates anyone; it only decides whether a sign-out
 * would touch the confirmed account's own callback session or somebody
 * else's.
 */
export function sessionMatchesCallback(session, proof) {
  if (!proof?.sub || !proof?.accessToken) return false;
  const id = session?.user?.id;
  return Boolean(id) && id === proof.sub && session.access_token === proof.accessToken;
}

/**
 * Resolve true once a session matching `proof` exists, false on timeout.
 *
 * Supabase Auth writes the session a network round-trip after the redirect
 * lands, so a single snapshot can miss it. This checks storage once, then
 * listens for auth events, re-checking the session each time. The check
 * runs on a microtask OUTSIDE the SDK's notifier so nothing auth-related
 * ever executes inside auth-js's own event delivery, and the subscription
 * is always torn down on resolution.
 *
 * Takes `auth` (supabase.auth) as a parameter so the rules can be unit
 * tested with a fake client and fake timers.
 */
export async function waitForCallbackSession(auth, proof, timeoutMs = CONFIRMATION_SETTLE_MS) {
  try {
    const { data } = await auth.getSession();
    if (sessionMatchesCallback(data?.session, proof)) return true;
  } catch {
    // Unreadable storage — fall through to the event listener.
  }

  return new Promise((resolve) => {
    let settled = false;
    let subscription = null;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        subscription?.unsubscribe();
      } catch {
        // Already gone — nothing to clean up.
      }
      resolve(value);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    try {
      const { data } = auth.onAuthStateChange((_event, session) => {
        Promise.resolve().then(() => {
          if (sessionMatchesCallback(session, proof)) finish(true);
        });
      });
      subscription = data?.subscription ?? null;
    } catch {
      finish(false);
    }
  });
}
