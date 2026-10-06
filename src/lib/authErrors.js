// Shared authentication / signup error messages and error-code mapping.
// Single source of truth used by Signup.jsx and VerifyEmail.jsx so both
// screens classify server errors identically.

export const AUTH_MSG = {
  invalidFormat: "Please enter a valid Gmail address.",
  emailProvider: "Unable to verify the email address at this time. Please try again later.",
  // Used only AFTER the Auth account already exists. The account is created and
  // verification is pending — never report this as a failed signup.
  emailProviderAfterCreate:
    "Your account was created successfully, but we couldn't send the verification email right now. Please try again later.",
  alreadyRegistered:
    "An account with this Gmail address already exists. Please log in or reset your password.",
  invalidOtp: "The verification code is incorrect or has expired. Please request a new code.",
  loginAgain: "Please log in again to continue verifying your email.",
  suspicious:
    "Registration was blocked because the activity was flagged as suspicious. Please try again later.",
  network: "Could not reach the server. Please check your connection and try again.",
  rateLimited: "Too many signups. Please wait a moment and try again.",
  captchaFailed: "Something went wrong. Please try again.",
  serverError: "Something went wrong. Please try again.",
  generic: "Something went wrong. Please try again.",
};

// Codes that describe a failure to PRODUCE the verification email. After the
// account exists these are reported with AUTH_MSG.emailProviderAfterCreate so
// a delivery outage is never mistaken for a failed signup.
const EMAIL_DELIVERY_CODES = [
  "EMAIL_PROVIDER_ERROR",
  "DELIVERY_FAILED",
  "UNDELIVERABLE",
];

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
  INVALID_CODE: AUTH_MSG.invalidOtp,
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
 * @param {{accountCreated?: boolean}} [opts] Set `accountCreated` once the Auth
 *   account exists, so a delivery failure is reported as a pending verification
 *   rather than as a problem with the address.
 * @returns {string} Message to display to the user.
 */
export function messageForCode(code, fallbackMsg, opts = {}) {
  const msg = typeof fallbackMsg === "string" ? fallbackMsg : "";
  const errCode = typeof code === "string" ? code : "";

  if (opts.accountCreated && EMAIL_DELIVERY_CODES.includes(errCode)) {
    return AUTH_MSG.emailProviderAfterCreate;
  }

  if (errCode && CODE_MESSAGES[errCode]) return CODE_MESSAGES[errCode];

  // Only when the backend gave us no usable code, and only for the
  // existing-registration case.
  if (!errCode && EXISTING_REGISTRATION_RE.test(msg)) return AUTH_MSG.alreadyRegistered;

  if (msg.trim()) return msg;

  return AUTH_MSG.generic;
}
