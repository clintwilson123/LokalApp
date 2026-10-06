// Shared authentication / signup error messages and error-code mapping.
// Single source of truth used by Signup.jsx and VerifyEmail.jsx so both
// screens classify server errors identically.

export const AUTH_MSG = {
  invalidFormat: "Please enter a valid Gmail address.",
  emailProvider: "Unable to verify the email address at this time. Please try again later.",
  alreadyRegistered: "This email is already registered. Try signing in instead.",
  suspicious:
    "Registration was blocked because the activity was flagged as suspicious. Please try again later.",
  network: "Could not reach the server. Please check your connection and try again.",
  rateLimited: "Too many signups. Please wait a moment and try again.",
  captchaFailed: "Something went wrong. Please try again.",
  serverError: "Something went wrong. Please try again.",
  generic: "Something went wrong. Please try again.",
};

// Strict code -> message table. Classification is by explicit error code only.
// DELIVERY_FAILED and UNDELIVERABLE are legacy codes: older deployed Edge
// Functions returned them for infrastructure/risk failures, never for a
// confirmed undeliverable address, so they map to the neutral message.
const CODE_MESSAGES = {
  NETWORK: AUTH_MSG.network,
  INVALID_FORMAT: AUTH_MSG.invalidFormat,
  ALREADY_REGISTERED: AUTH_MSG.alreadyRegistered,
  EMAIL_PROVIDER_ERROR: AUTH_MSG.emailProvider,
  DELIVERY_FAILED: AUTH_MSG.emailProvider,
  UNDELIVERABLE: AUTH_MSG.emailProvider,
  HIGH_RISK: AUTH_MSG.suspicious,
  SUSPICIOUS: AUTH_MSG.suspicious,
  RATE_LIMITED: AUTH_MSG.rateLimited,
  CAPTCHA_FAILED: AUTH_MSG.captchaFailed,
  SERVER_ERROR: AUTH_MSG.serverError,
};

// Narrow fallback used ONLY when no error code was supplied at all. Matches
// Supabase's own duplicate-account rejection from auth.signUp(). Deliberately
// does not classify on words such as "gmail", "deliver" or "invalid".
const EXISTING_REGISTRATION_RE = /already registered|duplicate/i;

/**
 * Resolve a user-facing message for a server error.
 *
 * @param {string} code   Explicit error code from an Edge Function (may be "").
 * @param {string} fallbackMsg Safe message supplied by the server.
 * @returns {string} Message to display to the user.
 */
export function messageForCode(code, fallbackMsg) {
  const msg = typeof fallbackMsg === "string" ? fallbackMsg : "";

  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  // Only when the backend gave us no usable code, and only for the
  // existing-registration case.
  if (!code && EXISTING_REGISTRATION_RE.test(msg)) return AUTH_MSG.alreadyRegistered;

  if (msg.trim()) return msg;

  return AUTH_MSG.generic;
}
