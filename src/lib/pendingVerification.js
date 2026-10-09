// State for "an account was created but its email is not confirmed yet".
//
// Supabase returns `session: null` from signUp() while Confirm email is
// enabled, so nothing about the pending signup survives in the auth session.
// These helpers are the only link between the Signup screen and /verify-email
// (and between that screen and the tab the confirmation link opens).
//
//   * sessionStorage — the same tab, which is what navigation state is for.
//   * localStorage   — email clients routinely open confirmation links in a
//                      NEW tab, and sessionStorage is per-tab. Without this
//                      copy the new tab would have no idea who is confirming.

const EMAIL_KEY = "cjlink:pending-verification-email";
const SIGNUP_KEY = "cjlink:pending-signup";
const VERIFIED_KEY = "cjlink:verified-notice";

// Long enough to outlive a slow reader, short enough that an abandoned
// signup cannot keep influencing routing a week later.
const PENDING_SIGNUP_TTL_MS = 2 * 60 * 60 * 1000;

// The notice only has to bridge the redirect from the confirmation callback
// to the screen that displays it. Short enough that a stale "verified"
// message can never be mistaken for a fresh confirmation later.
const VERIFIED_TTL_MS = 60 * 60 * 1000;

function storageOf(kind) {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    // Storage blocked (private mode / disabled cookies) — degrade to null.
    return null;
  }
}

function readFrom(kind, key) {
  try {
    return storageOf(kind)?.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeTo(kind, key, value) {
  try {
    storageOf(kind)?.setItem(key, value);
  } catch {
    // Quota or access error — the flow still works, just without persistence.
  }
}

function removeFrom(kind, key) {
  try {
    storageOf(kind)?.removeItem(key);
  } catch {
    // ignore
  }
}

/** Remember which address is waiting for its Supabase confirmation link. */
export function writePendingEmail(email) {
  const value = typeof email === "string" ? email.trim() : "";
  if (!value) return;
  writeTo("session", EMAIL_KEY, value);
  writeTo("local", EMAIL_KEY, value);
}

/** navState first, then sessionStorage, then localStorage. */
export function readPendingEmail(navState) {
  const fromNav = navState?.email;
  if (typeof fromNav === "string" && fromNav.trim()) return fromNav.trim();
  return readFrom("session", EMAIL_KEY) || readFrom("local", EMAIL_KEY);
}

export function clearPendingEmail() {
  removeFrom("session", EMAIL_KEY);
  removeFrom("local", EMAIL_KEY);
}

/**
 * Record a signup whose profile row could not be inserted yet because RLS
 * ("auth.uid() = id") has no session to check against. Consumed once the
 * confirmation link hands us a session.
 *
 * Lives in localStorage only: it must be visible to whichever tab ends up
 * holding the confirmed session.
 */
export function writePendingSignup(email, riskLevel) {
  const value = typeof email === "string" ? email.trim() : "";
  if (!value) return;
  writeTo(
    "local",
    SIGNUP_KEY,
    JSON.stringify({ email: value, riskLevel: riskLevel || "low", at: Date.now() })
  );
}

export function readPendingSignup() {
  const raw = readFrom("local", SIGNUP_KEY);
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeFrom("local", SIGNUP_KEY);
    return null;
  }
  if (!parsed || typeof parsed.email !== "string" || !parsed.email.trim()) {
    removeFrom("local", SIGNUP_KEY);
    return null;
  }
  if (Date.now() - (Number(parsed.at) || 0) > PENDING_SIGNUP_TTL_MS) {
    removeFrom("local", SIGNUP_KEY);
    return null;
  }
  // Normalise on read so a hand-edited or legacy entry can never miss the
  // address comparison in ensureProfile().
  parsed.email = parsed.email.trim();
  return parsed;
}

export function clearPendingSignup() {
  removeFrom("local", SIGNUP_KEY);
}

/**
 * Remember that Supabase Auth confirmed an address, so the screens the
 * redirect visits can say so and ask for a manual sign-in.
 *
 * localStorage only: whichever tab lands on the confirmation callback writes
 * it, and the original tab (or a later visit to /login) has to read it.
 *
 * This is a MESSAGE, never proof of authentication. Nothing here grants
 * access — it only decides what wording to show.
 */
export function writeVerifiedNotice(email) {
  const value = typeof email === "string" ? email.trim() : "";
  if (!value) return;
  writeTo("local", VERIFIED_KEY, JSON.stringify({ email: value, at: Date.now() }));
}

/** { email, at } while the notice is fresh, otherwise null (self-healing). */
export function readVerifiedNotice() {
  const raw = readFrom("local", VERIFIED_KEY);
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeFrom("local", VERIFIED_KEY);
    return null;
  }
  if (!parsed || typeof parsed.email !== "string" || !parsed.email.trim()) {
    removeFrom("local", VERIFIED_KEY);
    return null;
  }
  if (Date.now() - (Number(parsed.at) || 0) > VERIFIED_TTL_MS) {
    removeFrom("local", VERIFIED_KEY);
    return null;
  }
  parsed.email = parsed.email.trim();
  return parsed;
}

export function clearVerifiedNotice() {
  removeFrom("local", VERIFIED_KEY);
}
