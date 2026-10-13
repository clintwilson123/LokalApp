import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon, button, linkHighlight } from "../uiStyles";
import { sanitizeName, validateGmail, getPasswordStrength, maxLength } from "../lib/sanitize";
import { AUTH_MSG, messageForCode, isEmailDeliveryFailure } from "../lib/authErrors";
import { writePendingEmail, readGooglePrefill, clearGooglePrefill } from "../lib/pendingVerification";
import GoogleSignInButton from "../components/GoogleSignInButton";
import ConsentModal from "../components/ConsentModal";

const bgBlob = {
  position: "absolute", borderRadius: "50%", filter: "blur(80px)",
  opacity: 0.15, pointerEvents: "none", zIndex: 1,
};

// Extract a safe, user-facing error from a supabase.functions.invoke error
async function extractEdgeError(error) {
  // Network / fetch failure — true connectivity issue
  if (
    error?.name === "FunctionsFetchError" ||
    error?.message?.includes("Failed to send a request") ||
    error instanceof TypeError
  ) {
    return { message: AUTH_MSG.network, code: "NETWORK" };
  }

  // Non-2xx responses — body usually has { error, code }
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body?.error) {
        return { message: body.error, code: body.code || "EDGE_ERROR" };
      }
      if (body?.message) {
        return { message: body.message, code: body.code || "EDGE_ERROR" };
      }
    } catch {
      // Body already consumed or invalid JSON — fall through
    }
  }

  // FunctionsHttpError sometimes puts body text in message
  const raw = error?.message || "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error) return { message: parsed.error, code: parsed.code || "EDGE_ERROR" };
    } catch {
      // not JSON
    }
  }

  return { message: raw || AUTH_MSG.network, code: "UNKNOWN" };
}

async function invokeEdge(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const extracted = await extractEdgeError(error);
    const err = new Error(messageForCode(extracted.code, extracted.message));
    err.code = extracted.code;
    // Marks the error as coming from one of our Edge Functions so the caller
    // can classify strictly by err.code instead of by message content.
    err.source = "edge";
    throw err;
  }
  return data;
}

// Pre-signup checks only: Gmail format/risk, duplicate aliases and the
// signup rate limit. CAPTCHA is no longer part of the flow — Supabase Auth's
// CAPTCHA protection must be disabled in the Dashboard for signup to work.
async function runSpamChecks(email) {
  return invokeEdge("spam-prevention", { email });
}

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state || {};
  const { signUp, user, profile, loading: authLoading, loadProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // ACCOUNT_CREATION_FAILED vs ACCOUNT_CREATED_VERIFICATION_PENDING are distinct
  // states. Once signUp() hands back a user, a later OTP/delivery failure is
  // reported as a pending verification — never as a failed signup.
  const [accountCreated, setAccountCreated] = useState(false);
  // Synchronous submit guard: `loading` is state and will not have re-rendered
  // when two Enter keydowns arrive in the same event cycle.
  const submittingRef = useRef(false);
  // Read-only view of the consent document — closes without touching the
  // checkbox, the form or the route.
  const [consentOpen, setConsentOpen] = useState(false);

  // Google completion hand-off. The OAuth callback keeps the authenticated
  // Supabase session and hands the SAME user back here (never a second
  // account) with their Google address and name — navigation state first,
  // then the sessionStorage copy that survives a reload of this page.
  const googlePrefill = navState.googlePrefill || readGooglePrefill();
  // Only a signed-in OAUTH user whose address matches the prefill may enter
  // the completion form: a crafted navigation state can never walk a
  // password user (or a stranger's session) into it.
  const completingGoogle = Boolean(
    !authLoading &&
      user &&
      googlePrefill &&
      user.app_metadata?.provider !== "email" &&
      (googlePrefill.email || "").toLowerCase() === (user.email || "").toLowerCase()
  );
  const prefillName = completingGoogle ? googlePrefill.name || "" : "";
  const prefillEmail = completingGoogle ? googlePrefill.email || "" : "";

  // Escape / focus handling for the consent dialog lives in ConsentModal
  // itself, so both Signup forms get it without a second copy here.

  // Prefill once, without ever clobbering something the user already typed.
  useEffect(() => {
    if (!completingGoogle) return;
    setFullName((current) => current || prefillName);
    setEmail((current) => current || prefillEmail);
  }, [completingGoogle, prefillName, prefillEmail]);

  const strength = getPasswordStrength(password);

  const handleSignup = async () => {
    if (submittingRef.current) return;

    setError("");
    if (!fullName.trim() || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    // 1) Validate email format BEFORE any network calls
    const gmailCheck = validateGmail(email);
    if (!gmailCheck.valid) {
      // Distinct codes → distinct messages: INVALID_FORMAT = malformed
      // syntax, GMAIL_REQUIRED = non-Gmail domain. Risk verdicts can no
      // longer block here — they only set the risk level below, and the
      // address is proved real (or not) by the confirmation link.
      setError(messageForCode(gmailCheck.code, gmailCheck.reason));
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreed) {
      setError("You must accept the CJLink Consent Agreement to create an account.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      // Spam checks — hard gate (re-validates format/risk server-side).
      const spamResult = await runSpamChecks(email);
      const riskLevel = spamResult?.risk_level || "low";

      // Account creation. Once this returns a user, the account EXISTS — every
      // failure below is pending confirmation, never a failed signup. The
      // confirmation email is sent by Supabase Auth itself; nothing custom is
      // triggered from here.
      const signupResult = await signUp(
        email,
        password,
        maxLength(sanitizeName(fullName), 100),
        "applicant",
        riskLevel
      );

      if (!signupResult?.user) {
        // Supabase created nothing at all — the address is already registered.
        const dupErr = new Error(AUTH_MSG.alreadyRegistered);
        dupErr.code = "ALREADY_REGISTERED";
        dupErr.source = "edge";
        throw dupErr;
      }

      setAccountCreated(true);

      // Remember the address so /verify-email can still show and resend the
      // confirmation link — Confirm email is enabled, so signUp() handed us
      // session: null and nothing else carries it across a reload.
      const accountEmail = email.trim();
      writePendingEmail(accountEmail);

      navigate("/verify-email", {
        replace: true,
        state: { email: accountEmail, accountCreated: true },
      });
    } catch (err) {
      const code = typeof err?.code === "string" ? err.code : "";
      const status = Number(err?.status) || 0;
      // A Send Email hook / mailer failure — an email-send RATE LIMIT — or a
      // codeless HTTP 5xx (auth-js never reads the body of 500-range
      // responses, so a hook failure arrives with NO code) surfaces as an
      // error from signUp() even though Confirm email created the account
      // first (GoTrue writes the user, THEN sends). That must never read as
      // a dead-end "something went wrong" (a retry would say "already
      // registered" and login would say "confirm your email" with no way
      // out): remember the address and hand off to /verify-email, where a
      // resend exists and the real state is shown. The spam-prevention
      // RATE_LIMITED code is deliberately NOT included — that gate runs
      // BEFORE signUp(), so no account exists yet and the plain error is
      // the honest answer.
      const postCreationFailure =
        isEmailDeliveryFailure(err) ||
        code === "over_email_send_rate_limit" ||
        (!code && status >= 500 && status < 600);
      if (postCreationFailure) {
        const attempted = email.trim();
        writePendingEmail(attempted);
        navigate("/verify-email", {
          replace: true,
          state: {
            email: attempted,
            notice:
              code === "over_email_send_rate_limit"
                ? AUTH_MSG.rateLimitedAfterCreate
                : AUTH_MSG.signupEmailDeliveryFailed,
            noticeType: "error",
          },
        });
        return;
      }
      // Edge Functions classify by err.code; Supabase Auth exposes its own
      // AuthApiError code (e.g. user_already_exists, captcha_failed). Anything
      // else — PostgREST included — simply has no code and falls through to its
      // message inside messageForCode.
      setError(messageForCode(code, err?.message || ""));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  /**
   * Google completion submit.
   *
   * The account and the profiles row already exist (minted by
   * AuthContext.ensureOAuthProfile under the SAME Supabase user UUID). This
   * records only what the user explicitly reviewed here: the password they
   * chose so they can sign in manually later, their chosen full name, and the
   * consent they just ticked. Role, status and email_verified are never
   * touched — the database guard would refuse anyway.
   *
   * Order matters: the password is written FIRST. Supabase Auth stores a hash
   * for this same user (no second account, no change of sign-in provider), so
   * once it lands the person is guaranteed a working email + password login —
   * if it fails, nothing has been recorded and they simply retry.
   */
  const handleCompleteGoogle = async () => {
    if (submittingRef.current) return;
    setError("");

    const trimmedName = sanitizeName(fullName).trim();
    if (!trimmedName) {
      setError("Please enter your full name.");
      return;
    }
    if (!agreed) {
      setError("You must accept the CJLink Consent Agreement to continue.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      // 1) The password this person will type next time. GoTrue accepts it for
      //    the OAuth user directly — there is no confirmation round-trip and
      //    no provider switch; the Google identity stays linked.
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;

      // Never blank an existing name if the field was cleared by accident.
      const finalName = maxLength(trimmedName, 100) || String(profile?.full_name || "").slice(0, 100);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: finalName,
          consent_accepted: true,
          consent_accepted_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      clearGooglePrefill();
      try {
        await loadProfile?.(user.id);
      } catch {
        // The row is saved either way — ProtectedRoute re-reads it on the
        // next auth event if this refresh did not land.
      }
      navigate("/find-jobs", { replace: true });
    } catch (err) {
      const code = typeof err?.code === "string" ? err.code : "";
      setError(
        messageForCode(
          code,
          err?.message || "Could not finish setting up your account. Please try again."
        )
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      // Enter must submit whichever form is actually on screen — the password
      // signup form, or the Google completion form above it.
      if (completingGoogle) handleCompleteGoogle();
      else handleSignup();
    }
  };

  // ---------------------------------------------------------------------------
  // Google completion form.
  //
  // Shown when the OAuth callback handed a Google user back here because
  // their profile still owes consent — a brand-new account started from
  // /signup or /login alike: the account exists under the SAME Supabase UUID
  // and the session is kept. Written here: the password they choose (so a
  // later sign-in can be manual, email + password, without Google), the name
  // they choose, and the consent they explicitly tick. No CAPTCHA, no second
  // account — and nothing is overwritten that the user did not just review.
  // ---------------------------------------------------------------------------
  if (completingGoogle) {
    return (
      <div style={pageWrapper}>
        <div style={{ ...bgBlob, width: "350px", height: "350px", background: "#4a90e2", top: "-5%", right: "-5%" }} />
        <div style={{ ...bgBlob, width: "250px", height: "250px", background: "#a78bfa", bottom: "-5%", left: "-5%" }} />

        <div style={card}>
          <div>
            <div style={{ fontSize: "42px", marginBottom: "8px" }}>🎉</div>
            <h2 style={title}>Complete Your Account</h2>
            <p style={subtitle}>You&apos;re signed in with Google — just one step left</p>

            <div style={{
              padding: "12px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px",
              backgroundColor: "rgba(74,144,226,0.15)", border: "1px solid rgba(74,144,226,0.3)",
              color: "#93c5fd", textAlign: "center", lineHeight: 1.6,
            }}>
              Signed in as <strong>{prefillEmail}</strong> via Google.
              Your Google password stays with Google and is never shared with
              CJLink — set your own CJLink password below so you can also sign
              in with just your email and password.
            </div>

            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#fca5a5", fontSize: "13px", padding: "12px 16px", borderRadius: "10px",
                marginBottom: "16px", textAlign: "left",
              }}>
                <span>⚠️</span><span>{error}</span>
              </div>
            )}

            <div style={inputWrapper}>
              <span style={inputIcon}>👤</span>
              <input style={input} placeholder="Full Name" value={fullName}
                onChange={(e) => setFullName(sanitizeName(e.target.value))} onKeyDown={handleKeyDown} maxLength={100} />
            </div>
            <div style={inputWrapper}>
              <span style={inputIcon}>✉️</span>
              <input style={{ ...input, opacity: 0.7, cursor: "not-allowed" }} placeholder="Email address"
                type="email" value={email} readOnly disabled aria-readonly="true" title="Your verified Google address" />
            </div>

            {/* The password that makes a MANUAL sign-in possible later: it is
                stored (hashed) on this same account, so /login accepts email +
                password from now on — Google itself is never asked for it. */}
            <div style={inputWrapper}>
              <span style={inputIcon}>🔑</span>
              <input style={input} type="password" placeholder="Password (min. 6 characters)" value={password}
                onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} />
            </div>

            {password && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} style={{
                      flex: 1, height: "4px", borderRadius: "2px",
                      backgroundColor: i <= strength.score ? strength.color : "rgba(255,255,255,0.1)",
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: "11px", color: strength.color, fontWeight: "600" }}>
                  {strength.label}
                </span>
              </div>
            )}

            <div style={inputWrapper}>
              <span style={inputIcon}>🔒</span>
              <input style={input} type="password" placeholder="Confirm password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={handleKeyDown} />
            </div>

            <label style={checkboxLabel}>
              <input type="checkbox" checked={agreed}
                onChange={(e) => { setAgreed(e.target.checked); setError(""); }}
                style={{ width: "16px", height: "16px", cursor: "pointer" }} />
              <span>I have read and agree to the{" "}
                <button type="button"
                  onClick={(e) => { e.preventDefault(); setConsentOpen(true); }}
                  style={consentLinkBtn}>
                  CJLink Consent Agreement
                </button>
              </span>
            </label>

            {/* ONE way to read the agreement: the "CJLink Consent Agreement"
                link in the label above. A separate "View Consent" button sat
                right underneath it doing exactly the same thing. */}
            <button
              style={{ ...button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              onClick={handleCompleteGoogle} disabled={loading}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                  Finishing up...
                </span>
              ) : "Complete Sign-Up"}
            </button>
          </div>
        </div>

        <ConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} />
      </div>
    );
  }

  return (
    <div style={pageWrapper}>
      <div style={{ ...bgBlob, width: "350px", height: "350px", background: "#4a90e2", top: "-5%", right: "-5%" }} />
      <div style={{ ...bgBlob, width: "250px", height: "250px", background: "#a78bfa", bottom: "-5%", left: "-5%" }} />
      <div style={{ ...bgBlob, width: "180px", height: "180px", background: "#22c55e", top: "40%", left: "60%", transform: "translate(-50%, -50%)" }} />

      <div style={card}>
        <div>
          <div style={{ fontSize: "42px", marginBottom: "8px", display: "flex", justifyContent: "center" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#4a90e2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <h2 style={title}>Create Account</h2>
          <p style={subtitle}>Join CJLink and start your journey</p>

          {/* A red failure banner is only ever shown when NO account exists.
              Once the account is created the flow leaves this page for
              /verify-email, which reports delivery problems itself. */}
          {error && !accountCreated && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5", fontSize: "13px", padding: "12px 16px", borderRadius: "10px",
              marginBottom: "16px", textAlign: "left",
            }}>
              <span>⚠️</span><span>{error}</span>
            </div>
          )}

          {/* Google sign-up is offered here exactly as on Login: whichever
              page starts the round-trip, /auth/callback hands an applicant
              who still owes consent back prefilled instead of to a
              dashboard. Google's
              own account chooser is forced (prompt=select_account) so the
              active browser session is never silently reused. OAuth never
              needs the consent checkbox above the fold: a Google profile row
              starts with consent_accepted = false and the completion form
              collects it. */}
          <GoogleSignInButton />

          <div style={inputWrapper}>
            <span style={inputIcon}>👤</span>
            <input style={input} placeholder="Full Name" value={fullName}
              onChange={(e) => setFullName(sanitizeName(e.target.value))} onKeyDown={handleKeyDown} maxLength={100} />
          </div>
          <div style={inputWrapper}>
            <span style={inputIcon}>✉️</span>
            <input style={input} placeholder="Email address" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} />
          </div>
          <div style={inputWrapper}>
            <span style={inputIcon}>🔑</span>
            <input style={input} type="password" placeholder="Password (min. 6 characters)" value={password}
              onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} />
          </div>

          {password && (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{
                    flex: 1, height: "4px", borderRadius: "2px",
                    backgroundColor: i <= strength.score ? strength.color : "rgba(255,255,255,0.1)",
                  }} />
                ))}
              </div>
              <span style={{ fontSize: "11px", color: strength.color, fontWeight: "600" }}>
                {strength.label}
              </span>
            </div>
          )}

          <div style={inputWrapper}>
            <span style={inputIcon}>🔒</span>
            <input style={input} type="password" placeholder="Confirm password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={handleKeyDown} />
          </div>

          <label style={checkboxLabel}>
            <input type="checkbox" checked={agreed}
              onChange={(e) => { setAgreed(e.target.checked); setError(""); }}
              style={{ width: "16px", height: "16px", cursor: "pointer" }} />
            <span>I have read and agree to the{" "}
              <button type="button"
                onClick={(e) => { e.preventDefault(); setConsentOpen(true); }}
                style={consentLinkBtn}>
                CJLink Consent Agreement
              </button>
            </span>
          </label>

          {/* ONE way to read the agreement: the "CJLink Consent Agreement" link
              in the label above. A separate "View Consent" button used to sit
              right underneath it doing exactly the same thing. The link calls
              preventDefault so opening the document never ticks the checkbox,
              never navigates away and never loses what was typed. */}

          <button
            style={{
              ...button,
              letterSpacing: "0.4px",
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (loading) return;
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 6px 22px rgba(26, 115, 232, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(26, 115, 232, 0.3)";
            }}
            onClick={handleSignup} disabled={loading}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                Creating account...
              </span>
            ) : "Create Account"}
          </button>

          <p style={{ marginTop: "24px", fontSize: "14px", color: "rgba(255, 255, 255, 0.5)" }}>
            Already have an account? <Link to="/login" style={linkHighlight}>Sign in</Link>
          </p>
        </div>
      </div>

      <ConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} />
    </div>
  );
}

const checkboxLabel = {
  display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px",
  color: "rgba(255,255,255,0.6)", cursor: "pointer", marginBottom: "16px", textAlign: "left",
};
// The agreement name reads as a link because it opens the document — but it
// must NOT navigate away (that used to send people to a second page with a
// second, duplicate tick-box). preventDefault stops the wrapping <label>
// from ticking the checkbox when it is clicked.
const consentLinkBtn = {
  background: "none", border: "none", padding: 0, font: "inherit",
  color: "#93c5fd", cursor: "pointer", textDecoration: "underline",
};
