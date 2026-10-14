// Shared authentication / signup error messages and error-code mapping.
// Single source of truth used by Signup.jsx and VerifyEmail.jsx so both
// screens classify server errors identically.

export const AUTH_MSG = {
  // Malformed syntax ONLY. Whether a mailbox exists is never claimed here —
  // only a Supabase-validated verification code proves access to the address.
  invalidFormat: "Please enter a valid email address.",
  // Syntax is fine but the domain is not Gmail/Googlemail — the Gmail-only
  // product rule, kept distinct from a malformed address so the user is told
  // exactly which requirement failed.
  gmailRequired:
    "A Gmail address is required — CJLink signups use Gmail or Googlemail.",
  emailProvider: "Unable to verify the email address at this time. Please try again later.",
  // Used only AFTER the Auth account already exists. The account is created and
  // verification is pending — never report this as a failed signup.
  emailProviderAfterCreate:
    "Your account was created successfully, but we couldn't send the verification email right now. Please try again later.",
  alreadyRegistered:
    "An account with this Gmail address already exists. Please log in or reset your password.",
  invalidOtp: "The verification code is incorrect or has expired. Please request a new code.",
  // The OTP entry form, before the server is asked anything.
  otpIncomplete: "Enter the 6-digit verification code from your email.",
  // verifyOtp() outcomes. Kept separate from invalidOtp above (which is the
  // generic signup/Edge-Function code message) so the OTP screen can say
  // exactly what happened: expired vs already-used vs already-confirmed vs
  // throttled — never one blurred "incorrect or expired".
  otpExpired: "That code has expired. Please request a new one and enter it below.",
  otpUsed: "That code was already used. Please request a new one.",
  alreadyVerified: "This email address is already verified. Please sign in to your account.",
  verifyThrottled: "Too many attempts. Please wait a minute and try again.",
  loginAgain: "Please log in again to continue verifying your email.",
  // GoTrue refused the password grant because the address was never
  // confirmed. Kept distinct so the user is sent to the verification step,
  // never told their password is wrong or that the server is unreachable.
  // Wording is mode-neutral on purpose: /login cannot know whether this
  // build delivers a code or a link, and the verify screen itself says
  // exactly which to use.
  emailNotConfirmed:
    "Please confirm your email address first. Check your inbox for the verification email from CJLink.",
  suspicious:
    "Registration was blocked because the activity was flagged as suspicious. Please try again later.",
  network: "Could not reach the server. Please check your connection and try again.",
  rateLimited: "Too many signups. Please wait a moment and try again.",
  // Defensive only: Cloudflare Turnstile was removed and Supabase Auth's
  // CAPTCHA protection should be disabled in the Dashboard. The mapping is
  // kept so that if protection is ever re-enabled, a server rejection still
  // reads as a CAPTCHA problem — never as an invalid address or a connection
  // error.
  captchaFailed: "The security check failed. Please try again.",
  serverError: "Something went wrong. Please try again.",
  weakPassword: "Password must be at least 6 characters.",
  generic: "Something went wrong. Please try again.",
  // The confirmation link was rejected by Supabase Auth (expired, already
  // used, or malformed) — surfaced from the error fragment the link redirects
  // to the Site URL with. Kept distinct so a dead link is never reported as a
  // connection problem or as a generic failure.
  linkInvalidOrExpired:
    "This confirmation link is invalid or has expired. Please request a new one.",
  // The callback confirmed the address. The session it created is released on
  // purpose: verification never signs anyone in, the user does that themselves.
  verifiedSuccess: "Your email has been confirmed. Please sign in to your account.",
  // Confirmation-LINK panel wording (VITE_OTP_ENABLED off — the safe build).
  // Used only when Supabase Auth delivers a link instead of a 6-digit code.
  verifyLinkInstructions:
    "We sent a confirmation email to your address. Open it and click the button inside to verify.",
  verifyLinkResent:
    "Confirmation email sent again. It can take a minute to arrive.",
  verifyRecheckPending:
    "This address is not confirmed yet. Open the confirmation email and click the button, then try again.",
  verifyRecheckFailed:
    "Could not check your confirmation status right now. Please try again in a moment.",
  // signUp() threw what looks like an email-delivery failure: with Confirm
  // email enabled the account may already exist, so the user is never left on
  // a dead form — they are sent to /verify-email where a resend is available.
  signupEmailDeliveryFailed:
    "We couldn't send the verification email right now. If your account was created, you can resend the confirmation on the next screen.",
  // GoTrue creates the account BEFORE sending the email, so an email-send
  // rate limit (over_email_send_rate_limit) means the account exists but no
  // OTP went out. The hand-off to /verify-email (where resend lives) must say
  // so — a bare "too many signups" error would invite a retry that answers
  // "already registered" with no way forward.
  rateLimitedAfterCreate:
    "Your account was created, but too many verification emails were sent recently. Please wait a few minutes, then resend the code on the next screen.",
  // Google (OAuth) sign-in. Each state gets its own wording so a cancelled
  // attempt, a missing dashboard configuration and a real provider failure are
  // never blurred into one "something went wrong".
  oauthCancelled: "Google sign-in was cancelled. You can try again or sign in with your password.",
  oauthNotConfigured:
    "Google sign-in is not set up for this site yet. Please sign in with your email and password.",
  oauthFailed:
    "Could not sign in with Google right now. Please try again or sign in with your password.",
  oauthProfileFailed:
    "You signed in with Google, but we could not finish setting up your account. Please sign in with your password.",
  // Shared wording for a suspended account, wherever the refusal surfaces:
  // the password sign-in throw, ProtectedRoute's bounce off a protected page,
  // and the Google callback's hand-off check.
  suspended: "Your account has been suspended. Contact the administrator.",
  // The reset link leaves a LIVE session behind. Password recovery must end on
  // the sign-in form, not the dashboard, so /update-password releases that
  // session and lands here with noticeType "success" — which is also the flag
  // that stops Login auto-redirecting it onward.
  passwordUpdated:
    "Your password has been updated. Please sign in with your new password.",
  // A profile still showing consent as not accepted. Usually the sign-up tick
  // was lost on its way to the profile row: the marker that carries it expires
  // after two hours, so confirming later than that — or on a different device —
  // leaves the row saying "never consented" for someone who plainly did tick
  // the box. Login now collects it in place, with the same checkbox and the
  // same document, so this reads as a request rather than a dead end.
  consentRequired:
    "Please review and accept the CJLink Consent Agreement to continue.",
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
  GMAIL_REQUIRED: AUTH_MSG.gmailRequired,
  ALREADY_REGISTERED: AUTH_MSG.alreadyRegistered,
  EMAIL_PROVIDER_ERROR: AUTH_MSG.emailProvider,
  DELIVERY_FAILED: AUTH_MSG.emailProvider,
  UNDELIVERABLE: AUTH_MSG.emailProvider,
  HIGH_RISK: AUTH_MSG.suspicious,
  SUSPICIOUS: AUTH_MSG.suspicious,
  RATE_LIMITED: AUTH_MSG.rateLimited,
  CAPTCHA_FAILED: AUTH_MSG.captchaFailed,
  // GoTrue's own code when CAPTCHA protection is enabled and the token is
  // missing, expired or rejected by the provider.
  captcha_failed: AUTH_MSG.captchaFailed,
  // GoTrue's own code when Sign In is attempted before Confirm email is done.
  email_not_confirmed: AUTH_MSG.emailNotConfirmed,
  SERVER_ERROR: AUTH_MSG.serverError,
  INVALID_CODE: AUTH_MSG.invalidOtp,

  // Codes returned by Supabase Auth itself (AuthApiError.code) rather than by
  // one of our Edge Functions. Native confirmation is used for signup, so these
  // are now the codes signup/resend actually surface.
  user_already_exists: AUTH_MSG.alreadyRegistered,
  over_email_send_rate_limit: AUTH_MSG.rateLimited,
  email_address_invalid: AUTH_MSG.invalidFormat,
  email_address_not_authorized: AUTH_MSG.emailProvider,
  // GoTrue's catch-all when a server-side hook (including the Send Email hook)
  // fails during signup/resend. Reported as a delivery problem, never as a
  // problem with the address itself.
  unexpected_failure: AUTH_MSG.emailProvider,
  // Do not reveal whether an address exists when resending a confirmation.
  user_not_found: AUTH_MSG.emailProvider,
  weak_password: AUTH_MSG.weakPassword,
  signup_disabled: AUTH_MSG.serverError,
  validation_failed: AUTH_MSG.invalidFormat,

  // Supabase Auth link/callback failures, read from the error fragment the
  // confirmation link redirects to the Site URL with (error_code / error).
  otp_expired: AUTH_MSG.linkInvalidOrExpired,
  expired_code: AUTH_MSG.linkInvalidOrExpired,
  access_denied: AUTH_MSG.linkInvalidOrExpired,
};

// Narrow fallback used ONLY when no error code was supplied at all. Matches
// Supabase's own duplicate-account rejection from auth.signUp(). Deliberately
// does not classify on words such as "gmail", "deliver" or "invalid".
const EXISTING_REGISTRATION_RE = /already registered|duplicate/i;

// A pass-through server message must contain at least one word (3+ letters).
// This rejects auth-js's "{}" garbage (see messageForCode) and any other
// symbol-only string, while every human-readable sentence passes.
const USABLE_TEXT_RE = /[A-Za-z]{3,}/;

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

  // auth-js renders some infrastructure failures as JSON.stringify of the
  // bare fetch Response — for a 500 from /signup (e.g. the Send Email hook
  // failing) that is the literal string "{}". No words, no meaning: never
  // display it, fall through to the generic message.
  if (USABLE_TEXT_RE.test(msg)) return msg;

  return AUTH_MSG.generic;
}

// Codes supabase.auth.verifyOtp() can report for a failed verification.
const VERIFY_CODE_MESSAGES = {
  otp_expired: AUTH_MSG.otpExpired,
  expired_code: AUTH_MSG.otpExpired,
  session_expired: AUTH_MSG.otpExpired,
  otp_not_found: AUTH_MSG.invalidOtp,
  bad_token: AUTH_MSG.invalidOtp,
};

// Wording heuristics for verifyOtp() failures that arrive without a code.
// These only ever SELECT one of our own messages — unlike messageForCode,
// raw server text is never passed through: a verify error may echo request
// details (sub, token fragments, internals) the screen must not display.
const VERIFY_NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed/i;
const VERIFY_THROTTLE_RE = /rate\s*limit|too\s+many/i;
const VERIFY_CONFIRMED_RE = /already\s+confirmed/i;
const VERIFY_EXPIRED_RE = /expired/i;
const VERIFY_USED_RE = /already\s*(been\s*)?(used|claimed)|reused|not\s+active/i;

/**
 * Resolve a user-facing message for a verifyOtp() failure.
 *
 * Classification order mirrors how a person would triage it: an explicit
 * error code wins, then infrastructure (no connection), then throttling
 * (wait), then the specific code states, and finally the generic
 * wrong-code message. Nothing here ever echoes the server's own text.
 *
 * @param {{code?: string, message?: string, status?: number}|Error|undefined} err
 * @returns {string} Message to display to the user.
 */
export function messageForVerifyError(err) {
  const code = typeof err?.code === "string" ? err.code : "";
  const msg = typeof err?.message === "string" ? err.message : "";
  const status = Number(err?.status) || 0;

  if (code && VERIFY_CODE_MESSAGES[code]) return VERIFY_CODE_MESSAGES[code];

  // Connectivity first: a dead network must never be reported as a bad code.
  if (err instanceof TypeError || VERIFY_NETWORK_RE.test(msg)) return AUTH_MSG.network;

  if (status === 429 || VERIFY_THROTTLE_RE.test(msg)) return AUTH_MSG.verifyThrottled;
  if (VERIFY_CONFIRMED_RE.test(msg)) return AUTH_MSG.alreadyVerified;
  if (VERIFY_EXPIRED_RE.test(msg)) return AUTH_MSG.otpExpired;
  if (VERIFY_USED_RE.test(msg)) return AUTH_MSG.otpUsed;

  // Default: the code was simply wrong (or we cannot classify the failure —
  // and guessing more specifically would risk telling the user something
  // untrue about their account).
  return AUTH_MSG.invalidOtp;
}

// ---------------------------------------------------------------------------
// Resend classification (/verify-email -> supabase.auth.resend).
//
// Deliberately stricter than messageForCode: raw server text is NEVER passed
// through, because a resend failure can echo request internals. Known codes
// map exactly; everything else lands on the account-aware delivery wording.
// ---------------------------------------------------------------------------
export function messageForResendError(err, opts = {}) {
  const code = typeof err?.code === "string" ? err.code : "";
  const msg = typeof err?.message === "string" ? err.message : "";
  const status = Number(err?.status) || 0;

  if (code && CODE_MESSAGES[code]) {
    if (opts.accountCreated && EMAIL_DELIVERY_CODES.includes(code)) {
      return AUTH_MSG.emailProviderAfterCreate;
    }
    return CODE_MESSAGES[code];
  }

  if (err instanceof TypeError || VERIFY_NETWORK_RE.test(msg)) return AUTH_MSG.network;
  if (status === 429 || VERIFY_THROTTLE_RE.test(msg)) return AUTH_MSG.rateLimited;

  return opts.accountCreated ? AUTH_MSG.emailProviderAfterCreate : AUTH_MSG.emailProvider;
}

// ---------------------------------------------------------------------------
// Did signUp() fail in a way that means "the account may already exist, but
// its verification email could not be delivered"?
//
// With Confirm email enabled GoTrue creates the user BEFORE the Send Email
// hook runs, so a hook/provider failure surfaces as an error from signUp()
// while the account is already there. Treating that as a failed signup would
// strand the user (a retry says "already registered", login says
// "email_not_confirmed", and the dead form offers no resend). The caller
// routes these to /verify-email instead, where a resend exists.
//
// Only explicit delivery codes and 5xx server errors whose own message
// mentions the email/confirmation path qualify — a weak password or a
// rejected CAPTCHA never does.
// ---------------------------------------------------------------------------
const SIGNUP_DELIVERY_CODES = new Set([
  ...EMAIL_DELIVERY_CODES,
  "unexpected_failure",
  "email_send_failed",
  "hook_error",
]);
const DELIVERY_FAIL_RE = /email|confirmation|mailer|send/i;

export function isEmailDeliveryFailure(err) {
  const code = typeof err?.code === "string" ? err.code : "";
  if (SIGNUP_DELIVERY_CODES.has(code)) return true;
  const status = Number(err?.status) || 0;
  const msg = typeof err?.message === "string" ? err.message : "";
  return status >= 500 && DELIVERY_FAIL_RE.test(msg);
}

// Words Supabase Auth uses when the Google provider is switched off in the
// Dashboard (or the OAuth client is misconfigured). Matched against the
// server's own message so the user is told the feature is unavailable rather
// than that their account is broken.
const OAUTH_NOT_CONFIGURED_RE =
  /provider\s+(is\s+)?not\s+(enabled|supported)|oauth\s+provider|invalid\s+(client|redirect)|not\s+enabled/i;

/**
 * Resolve a user-facing message for a failed signInWithOAuth() start.
 *
 * The redirect has not happened yet, so this covers "Google could not be
 * started at all": the provider is disabled in the Dashboard, the client ID
 * or secret is wrong, or the request never left the browser. A cancelled
 * sign-in happens on Google's side and is classified by the callback instead.
 *
 * @param {Error|{message?:string, code?:string, status?:number}|undefined} err
 * @returns {string} Message to display to the user.
 */
export function messageForOAuthError(err) {
  const msg = typeof err?.message === "string" ? err.message : "";
  const code = typeof err?.code === "string" ? err.code : "";

  if (err instanceof TypeError || /failed to fetch|network|load failed/i.test(msg)) {
    return AUTH_MSG.network;
  }
  if (code === "provider_not_enabled" || OAUTH_NOT_CONFIGURED_RE.test(msg)) {
    return AUTH_MSG.oauthNotConfigured;
  }
  return AUTH_MSG.oauthFailed;
}
