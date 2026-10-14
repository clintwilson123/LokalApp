import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { postAuthPath } from "../lib/authFlow";
import { AUTH_MSG, messageForCode } from "../lib/authErrors";
import { supabase } from "../lib/supabaseClient";
import ConsentModal from "../components/ConsentModal";
import {
  writePendingEmail,
  clearPendingEmail,
  clearVerifiedNotice,
  readLoginFlash,
  clearLoginFlash,
} from "../lib/pendingVerification";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon, button, link, linkHighlight, radii } from "../uiStyles";

const bgBlob = {
  position: "absolute",
  borderRadius: "50%",
  filter: "blur(80px)",
  opacity: 0.15,
  pointerEvents: "none",
  zIndex: 1,
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user, profile, loading, loadProfile, signOut } = useAuth();
  // Carried by the confirmation callback (verified, sign in yourself) and by
  // the error fragment from a dead link.
  const navState = location.state || {};
  // One-shot hand-off from the OTP screen's hard-reset path (a full-page
  // reload cannot carry navigation state). Read during the first render as
  // a pure read — StrictMode double-invokes initializers, so consuming it
  // here would eat the message — and consumed just after mount instead.
  const [flash] = useState(() => readLoginFlash());
  useEffect(() => {
    clearLoginFlash();
  }, []);
  const notice = navState.notice || (flash ? AUTH_MSG.verifiedSuccess : "");
  const successNotice = navState.noticeType === "success" || Boolean(flash);
  // The confirmed address, when the callback knew it — saves retyping.
  const [email, setEmail] = useState(navState.email || flash?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // Set only for "Wrong email or password": the single most likely cause is a
  // Google account typing its GOOGLE password, which CJLink can never know.
  // The error alone gives no way to discover that, so the fix is spelled out.
  const [googleHint, setGoogleHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSignedIn, setJustSignedIn] = useState(false);
  const [userName, setUserName] = useState("");
  // Consent panel state — only ever rendered for a live applicant session
  // whose profile still owes the agreement.
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);

  const owesConsent = Boolean(profile && profile.role !== "admin" && !profile.consent_accepted);

  // Redirect only once auth AND profile loading have settled, and never while
  // the welcome overlay is showing. One rule for everyone: an authenticated but
  // unverified applicant goes to /verify-email, and /verify-email never sends
  // them back here while they still hold a session.
  //
  // The exception: a success notice means verification just finished here —
  // carried by navigation state (the normal OTP / confirmation hand-off) or
  // by the one-shot flash (the hard-reset path). Either way the user signs
  // in with their password first, so no session (or a leftover one the
  // sign-out could not clear) ever auto-redirects past this screen.
  useEffect(() => {
    if (loading || justSignedIn) return;
    if (successNotice) return;
    if (!user || !profile) return;
    // A suspended session stays on this screen (with the notice that arrived
    // via navigation state) instead of bouncing to the dashboard and back —
    // ProtectedRoute would send it straight here again.
    if (profile.status === "suspended") return;
    // Same rule for an applicant that still owes consent: ProtectedRoute parks
    // it here with the reason, and shipping it onward on the next line would
    // send it straight back — a two-screen loop with no progress. "Continue
    // with Google" is the way forward; the callback hands it to the completion
    // form that collects the tick.
    if (profile.role !== "admin" && !profile.consent_accepted) return;
    navigate(postAuthPath(profile, user), { replace: true });
  }, [user, profile, loading, justSignedIn, successNotice, navigate]);

  const handleLogin = async () => {
    setError("");
    setGoogleHint(false);
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await signIn(email, password);
      // A real password sign-in retires the whole verification handoff: the
      // pending address and the "just confirmed" notice have done their job,
      // and a stale one must never influence a later routing decision.
      clearPendingEmail();
      clearVerifiedNotice();
      setUserName(
        result?.user?.user_metadata?.full_name ||
        result?.user?.email?.split("@")[0] ||
        "there"
      );
      const signedInRole = result?.role || "applicant";
      // Unverified applicants keep their session and are routed to the OTP
      // screen; admins bypass verification exactly as ProtectedRoute does.
      const emailVerified =
        Boolean(result?.email_verified) || Boolean(result?.user?.email_confirmed_at);
      // ProtectedRoute bounces an applicant that still owes consent straight
      // back to this screen, so shipping it to a protected route would be a
      // loop that never makes progress. The consent panel that replaces this
      // form collects the tick in place instead. Strict equality: a caller
      // whose result predates the field must not be blocked by an absence.
      if (signedInRole !== "admin" && result?.consent_accepted === false) {
        setSubmitting(false);
        return;
      }
      const destination =
        signedInRole === "admin" ? "/admin" : emailVerified ? "/find-jobs" : "/verify-email";
      setJustSignedIn(true);
      setSubmitting(false);
      setTimeout(() => {
        navigate(destination, { replace: true });
      }, 1400);
    } catch (err) {
      const code = typeof err?.code === "string" ? err.code : "";
      if (code === "captcha_failed" || code === "CAPTCHA_FAILED") {
        // Defensive only: CAPTCHA protection should be off in the Dashboard.
        // If it is ever re-enabled, a rejection still reads as a CAPTCHA
        // problem — never as a wrong-password or connection error.
        setError(messageForCode(code, err.message));
      } else if (err.message?.includes("Invalid login credentials")) {
        setError("Wrong email or password.");
        setGoogleHint(true);
      } else if (
        code === "email_not_confirmed" ||
        err.message?.includes("verify your email") ||
        err.message?.includes("Email not confirmed")
      ) {
        // Supabase itself is refusing the sign-in: no session exists, so
        // there is nothing to access. Remember the attempted address so
        // /verify-email can display it and resend the confirmation, then
        // send the user there with a clear instruction instead of a raw
        // server string — and never a redirect loop (/verify-email only
        // comes back here via an explicit "use a different email").
        const attempted = email.trim();
        writePendingEmail(attempted);
        setError(AUTH_MSG.emailNotConfirmed);
        navigate("/verify-email", {
          state: { email: attempted, notice: AUTH_MSG.emailNotConfirmed },
        });
      } else {
        setError(err.message || "Login failed.");
      }
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  /**
   * Record the acceptance NOW, in this session, by this person.
   *
   * Never back-dated to the sign-up where the tick got lost — that is what
   * makes this a genuine consent record rather than a guess about one. The
   * timestamp written here is the moment the agreement was actually given.
   */
  const acceptConsent = async () => {
    if (!consentChecked || consentSaving || !user) return;
    setConsentSaving(true);
    setError("");
    try {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ consent_accepted: true, consent_accepted_at: new Date().toISOString() })
        .eq("id", user.id);
      if (updateErr) throw updateErr;

      // Refresh the context row first, or ProtectedRoute would still be
      // reading the stale one and bounce us straight back to this screen.
      await loadProfile(user.id);
      navigate(postAuthPath(profile, user), { replace: true });
    } catch {
      setError("We could not save that just now. Please try again.");
    } finally {
      setConsentSaving(false);
    }
  };

  /**
   * A live applicant session that still owes consent.
   *
   * ProtectedRoute parks it here with AUTH_MSG.consentRequired, and the only
   * way out used to be "Continue with Google" — which an email+password user
   * has no reason and no means to use. That made it a genuine dead end: the
   * person HAD ticked the box at sign-up, but the marker carrying that tick
   * expires after two hours, so a later confirmation wrote "never consented"
   * onto a profile whose owner had plainly consented. The agreement is
   * collected here instead — same checkbox, same document, same dialog — so
   * the tick counts wherever the person actually gives it.
   */
  if (owesConsent) {
    return (
      <div style={pageWrapper}>
        <div style={{ ...bgBlob, width: "400px", height: "400px", background: "#4a90e2", top: "-10%", left: "-5%" }} />
        <div style={{ ...bgBlob, width: "300px", height: "300px", background: "#a78bfa", bottom: "-5%", right: "-5%" }} />

        <div style={card}>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>📋</div>
          <h2 style={title}>One last step</h2>
          <p style={subtitle}>
            Your account is ready. Please review and accept the CJLink Consent
            Agreement to continue.
          </p>

          {notice && <div style={consentNotice}>{notice}</div>}
          {error && <div style={consentError}>{error}</div>}

          <label style={consentCheckbox}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => { setConsentChecked(e.target.checked); setError(""); }}
              style={{ width: "16px", height: "16px", cursor: "pointer", marginTop: "2px", flexShrink: 0 }}
            />
            <span>
              I have read and agree to the{" "}
              <button type="button" onClick={() => setConsentOpen(true)} style={consentLinkBtn}>
                CJLink Consent Agreement
              </button>
            </span>
          </label>

          <button
            style={{
              ...button,
              marginTop: "18px",
              opacity: consentChecked && !consentSaving ? 1 : 0.6,
              cursor: consentChecked && !consentSaving ? "pointer" : "not-allowed",
            }}
            onClick={acceptConsent}
            disabled={!consentChecked || consentSaving}
          >
            {consentSaving ? "Saving..." : "Accept and continue"}
          </button>

          <button type="button" onClick={signOut} style={consentSignOut}>
            Use a different account
          </button>
        </div>

        <ConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} />
      </div>
    );
  }

  return (
    <div style={pageWrapper}>
      <div style={{ ...bgBlob, width: "400px", height: "400px", background: "#4a90e2", top: "-10%", left: "-5%" }} />
      <div style={{ ...bgBlob, width: "300px", height: "300px", background: "#a78bfa", bottom: "-5%", right: "-5%" }} />
      <div style={{ ...bgBlob, width: "200px", height: "200px", background: "#22c55e", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />

      <div style={card}>
        <div style={{
          opacity: justSignedIn ? 0 : 1,
          transition: "opacity 0.35s ease",
        }}>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
          <h2 style={title}>Welcome Back</h2>
          <p style={subtitle}>Sign in to your CJLink account</p>

          {notice && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: successNotice ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${successNotice ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              color: successNotice ? "#86efac" : "#fca5a5",
              fontSize: "13px",
              padding: "12px 16px",
              borderRadius: "10px",
              marginBottom: "16px",
              textAlign: "left",
              fontWeight: "600",
            }}>
              <span>{successNotice ? "✅ " : "⚠️ "}</span>
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: "13px",
              padding: "12px 16px",
              borderRadius: "10px",
              marginBottom: "16px",
              textAlign: "left",
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Shown ONLY for the invalid-credentials case. Without this the
              screen is a dead end: a Google account has just typed the one
              password CJLink is structurally incapable of checking, and
              nothing on the page says so. */}
          {error && googleHint && (
            <div style={{
              background: "rgba(74,144,226,0.12)",
              border: "1px solid rgba(74,144,226,0.3)",
              color: "#93c5fd",
              fontSize: "13px",
              padding: "12px 16px",
              borderRadius: "10px",
              marginBottom: "16px",
              textAlign: "left",
              lineHeight: 1.6,
            }}>
              <strong>Signed up with Google?</strong> Your Google password stays
              with Google and is never shared with CJLink, so it will never work
              here. Use <strong>Continue with Google</strong> instead — the first
              time, CJLink asks you to choose a password of your own, and that is
              the one this form accepts.
            </div>
          )}

          {/* Sign-in with Google sits ABOVE the password form, the standard
              placement people expect. A Google user who already has a CJLink
              account is sent onward by /auth/callback exactly like a password
              sign-in: admin only when the DATABASE profile says admin,
              otherwise /find-jobs. One who does NOT — no completed account
              yet — is never dropped into the dashboard: the callback hands
              them to the /signup completion form (same session, same UUID,
              Google address and name prefilled) to finish signing up first.
              Google's own password is collected on Google's screen, never
              here. */}
          <GoogleSignInButton />

          <div style={inputWrapper}>
            <span style={inputIcon}>✉️</span>
            <input
              style={input}
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div style={inputWrapper}>
            <span style={inputIcon}>🔑</span>
            <input
              style={input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
            <Link to="/forgot-password" style={link}>
              Forgot password?
            </Link>
          </div>

          <button
            style={{ ...button, opacity: submitting ? 0.7 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
            onClick={handleLogin}
            disabled={submitting}
          >
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>

          <p style={{ marginTop: "24px", fontSize: "14px", color: "rgba(255, 255, 255, 0.5)" }}>
            Don't have an account?{" "}
            <Link to="/signup" style={linkHighlight}>
              Sign up
            </Link>
          </p>
        </div>

        {/* Success overlay */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: radii.xxl,
          opacity: justSignedIn ? 1 : 0,
          pointerEvents: justSignedIn ? "auto" : "none",
          transition: "opacity 0.5s ease",
          zIndex: 10, padding: "40px",
        }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="30" fill="none" stroke="#4a90e2" strokeWidth="3"
              style={{
                strokeDasharray: 188.5, strokeDashoffset: justSignedIn ? 0 : 188.5,
                transition: "stroke-dashoffset 0.6s ease 0.2s",
              }} />
            <polyline points="20,32 28,40 44,24" fill="none" stroke="#4a90e2" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              style={{
                strokeDasharray: 34, strokeDashoffset: justSignedIn ? 0 : 34,
                transition: "stroke-dashoffset 0.4s ease 0.7s",
              }} />
          </svg>
          <h2 style={{
            margin: "16px 0 0", color: "#fff", fontSize: "22px", fontWeight: "700",
            transform: justSignedIn ? "translateY(0)" : "translateY(12px)",
            opacity: justSignedIn ? 1 : 0,
            transition: "all 0.4s ease 0.6s",
          }}>
            Welcome back, {userName}!
          </h2>
          <p style={{
            color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "8px 0 0",
            transform: justSignedIn ? "translateY(0)" : "translateY(12px)",
            opacity: justSignedIn ? 1 : 0,
            transition: "all 0.4s ease 0.75s",
          }}>
            Taking you to your dashboard...
          </p>
        </div>
      </div>
    </div>
  );
}

const consentNotice = {
  background: "rgba(217, 119, 6, 0.15)",
  border: "1px solid rgba(217, 119, 6, 0.3)",
  color: "#fcd34d",
  fontSize: "13px",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "16px",
  textAlign: "left",
  fontWeight: 600,
};

const consentError = {
  background: "rgba(239, 68, 68, 0.15)",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  color: "#fca5a5",
  fontSize: "13px",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "16px",
  textAlign: "left",
  fontWeight: 600,
};

const consentCheckbox = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  marginTop: "18px",
  fontSize: "13px",
  color: "rgba(255, 255, 255, 0.85)",
  lineHeight: "1.6",
  textAlign: "left",
};

// Reads as a link because it opens the document — but it is a button, so it
// never navigates away and never loses the tick.
const consentLinkBtn = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#93c5fd",
  fontWeight: 700,
  fontSize: "13px",
  textDecoration: "underline",
  cursor: "pointer",
};

// Always available: someone parked here by mistake must still be able to leave.
const consentSignOut = {
  display: "block",
  width: "100%",
  marginTop: "12px",
  background: "none",
  border: "none",
  color: "rgba(255, 255, 255, 0.5)",
  fontSize: "12px",
  cursor: "pointer",
  textDecoration: "underline",
};
