// Feature flag for the 6-digit email OTP verification screen.
//
// Email OTP is now the PRIMARY signup verification panel: the Send Email hook
// (supabase/functions/send-auth-email -> EmailJS) delivers a 6-digit code for
// the signup action, and VerifyEmail asks for it by default.
//
//   VITE_OTP_ENABLED unset / "true" / anything except "false"
//                          ->  6-digit CODE panel (primary)
//   VITE_OTP_ENABLED=false ->  confirmation LINK panel (rollback)
//
// The rollback exists because the delivery chain (Dashboard hook + EmailJS
// secrets/templates) lives outside this repository and cannot be verified at
// build time. VITE_ variables are inlined at build time, so flipping the flag
// requires a redeploy — and it must be flipped together with the Dashboard
// hook, never on its own:
//   * flag ON  + hook OFF  -> the panel asks for a code the mailer never sends
//                             (if the default GoTrue mailer still delivers a
//                             confirmation LINK, clicking it also verifies)
//   * flag OFF + hook ON   -> the email carries a code with no panel to enter
//                             it into (the link panel's resend still works,
//                             and GoTrue still accepts verifyOtp if reached)
export function isOtpDeliveryEnabled() {
  const raw = String(import.meta.env.VITE_OTP_ENABLED ?? "").trim().toLowerCase();
  return raw !== "false";
}
