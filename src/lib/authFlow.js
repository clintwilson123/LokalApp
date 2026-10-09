// Pure decision helpers for the signup -> verify -> login flow.
//
// Deliberately free of React and Supabase imports so the redirect rules can be
// unit tested in isolation. Every redirect in the app is derived from one of
// these functions, which is what keeps /verify-email, /login and /signup from
// bouncing users between each other.

export const VERIFY_EMAIL_PATH = "/verify-email";
export const LOGIN_PATH = "/login";
export const ADMIN_PATH = "/admin";
export const APPLICANT_PATH = "/find-jobs";

/**
 * Single source of truth for "is this email verified?".
 *
 * Decided from the Auth session alone (user.email_confirmed_at — the value
 * GoTrue itself writes at confirmation time). profiles.email_verified is a
 * mirror kept for display, but it is never enough on its own: only the
 * current Auth user's own state may authorize access. A stale mirror saying
 * "false" cannot bounce a really-confirmed user, and a mirror saying "true"
 * can never open a route for an unconfirmed one.
 */
export function isEmailVerified(user) {
  return Boolean(user?.email_confirmed_at);
}

/**
 * Resolve the role without ever inventing one. Falls back to the value Supabase
 * stored on the user at signup, and only then to "applicant".
 */
export function roleOf(profile, user) {
  return profile?.role || user?.user_metadata?.role || "applicant";
}

/** Role-based destination for a user who is allowed into the app. */
export function dashboardPathFor(role) {
  return role === "admin" ? ADMIN_PATH : APPLICANT_PATH;
}

/**
 * Where an authenticated user should land.
 *
 * Rule: an authenticated but unverified applicant is allowed (and required) to
 * use /verify-email. Admins are exempt from verification, matching the existing
 * requireVerification={false} routes.
 */
export function postAuthPath(profile, user) {
  const role = roleOf(profile, user);
  if (role !== "admin" && !isEmailVerified(user)) return VERIFY_EMAIL_PATH;
  return dashboardPathFor(role);
}

/**
 * What /verify-email should render for the current auth state.
 *
 * "loading"          auth/session state not settled yet -> render a spinner, NEVER redirect
 * "login-again"      no session AND no remembered pending address -> show a message
 *                    (no automatic redirect, so this cannot form a loop with /login)
 * "already-verified" verified -> send the user to their dashboard
 * "form"             unverified -> show the confirmation-link panel
 *
 * `pendingEmail` matters because Confirm email is enabled: signUp() returns
 * `session: null`, so a freshly signed-up visitor is legitimately here with no
 * session at all. Forgetting that address must not eject them back to /login.
 */
export function verifyPageState({ loading, user, pendingEmail = "" }) {
  if (loading) return "loading";
  if (user && isEmailVerified(user)) return "already-verified";
  if (user) return "form";
  if (typeof pendingEmail === "string" && pendingEmail.trim()) return "form";
  return "login-again";
}
