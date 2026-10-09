import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon } from "../uiStyles";
import { AUTH_MSG, messageForCode, messageForVerifyError } from "../lib/authErrors";
import { verifyPageState, dashboardPathFor, roleOf } from "../lib/authFlow";
import { isTurnstileConfigured } from "../lib/turnstile";
import TurnstileWidget from "../components/TurnstileWidget";
import {
  readPendingEmail,
  clearPendingEmail,
  clearPendingSignup,
  clearVerifiedNotice,
  readVerifiedNotice,
  writeLoginFlash,
} from "../lib/pendingVerification";

// Supabase throttles resends itself; this mirrors its 60 s floor so the button
// is honest rather than racing the server into an over_email_send_rate_limit.
const RESEND_COOLDOWN_SECONDS = 60;

const OTP_LENGTH = 6;

// A signOut that reports failure is retried a few times before the caller
// falls back to wiping the persisted keys: short waits, because this is
// cleanup, not the action the user is waiting for.
const SIGNOUT_RETRY_DELAYS_MS = [100, 200, 400];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Release the session with scope "local" (other devices stay signed in),
 * retrying a reported failure a few times. Returns the last error, or null
 * once GoTrue confirms the session is gone.
 */
async function signOutLocalWithRetries(auth) {
  let lastError = null;
  for (let attempt = 0; attempt <= SIGNOUT_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { error } = await auth.signOut({ scope: "local" });
      if (!error) return null;
      lastError = error;
    } catch (err) {
      lastError = err;
    }
    if (attempt < SIGNOUT_RETRY_DELAYS_MS.length) {
      await sleep(SIGNOUT_RETRY_DELAYS_MS[attempt]);
    }
  }
  return lastError;
}

/** Drop every persisted Supabase Auth session key — last-resort cleanup. */
function clearStoredAuthKeys() {
  try {
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (const key of Object.keys(store)) {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) store.removeItem(key);
      }
    }
  } catch {
    // Storage blocked — the flash below still lands on a later /login.
  }
}

export default function VerifyEmail() {
  const { user, profile, loading: authLoading, refreshSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navState = location.state || {};

  // Confirm email is enabled, so a freshly signed-up visitor has no session:
  // the address comes from navigation state, then from what was persisted
  // across the reload, and only then from the signed-in user.
  const sessionEmail = user?.email || readPendingEmail(navState);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // Carried from Login when GoTrue refused the password grant with
  // email_not_confirmed — the user is redirected here with the reason.
  const [message, setMessage] = useState({
    text: navState.notice || "",
    type: navState.notice ? "error" : "",
  });
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const [verified, setVerified] = useState(false);
  // The six digits typed by the user. Client-side input shaping only —
  // correctness is decided by supabase.auth.verifyOtp() on the server.
  const [otp, setOtp] = useState("");
  // Turnstile handle for the resend action: /resend is captcha-protected once
  // the Dashboard toggle is enabled.
  const captchaRef = useRef(null);

  const pageState = verifyPageState({
    loading: authLoading,
    user,
    profile,
    pendingEmail: sessionEmail,
  });

  // Fresh read on every render: the callback in another tab writes this
  // while this screen may already be mounted. A MATCHING notice drives the
  // success state — never a session on its own, and never an address that
  // disagrees with what this screen is showing.
  const verifiedNotice = readVerifiedNotice();
  const noticeMatch = Boolean(verifiedNotice) &&
    (!sessionEmail || verifiedNotice.email.toLowerCase() === sessionEmail.toLowerCase());
  const noticeDriven = Boolean(noticeMatch) &&
    (pageState === "already-verified" || (pageState === "form" && !user));

  // A notice arriving with navigation state (e.g. the error fragment from an
  // expired link) is shown as soon as this screen learns about it.
  useEffect(() => {
    if (!navState.notice) return;
    setMessage({
      text: navState.notice,
      type: navState.noticeType === "success" ? "success" : "error",
    });
  }, [navState.notice, navState.noticeType]);

  // Resend cooldown.
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Supabase Auth confirmed the address (the link landed here, or in another
  // tab and this one picked it up from storage).
  //
  // With a fresh confirmation notice: show the success state with a Sign In
  // button and NO dashboard timer — verification never logs anyone in. The
  // notice is wording only: if a session outlived the confirmation, the
  // confirmation callback owns its cleanup (proof-based, in the tab the link
  // opened), and this screen never signs anyone out on a notice's say-so.
  //
  // Without a notice this is simply a pre-existing signed-in, verified
  // visitor: keep the short handoff to their dashboard.
  useEffect(() => {
    if (noticeDriven) {
      setVerified(true);
      return;
    }
    if (pageState !== "already-verified") return;
    setVerified(true);
    const timer = setTimeout(() => {
      navigate(dashboardPathFor(roleOf(profile, user)), { replace: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [noticeDriven, pageState, profile, user, navigate]);

  const handleResend = async () => {
    if (resending || loading || verified) return;
    if (countdown > 0 || !sessionEmail) return;

    // Turnstile gate — before any network call. An empty token would be
    // refused by GoTrue's /resend route once CAPTCHA protection is enabled.
    if (!isTurnstileConfigured()) {
      setMessage({ text: AUTH_MSG.captchaNotConfigured, type: "error" });
      return;
    }
    const captchaToken = captchaRef.current?.getToken() || "";
    if (!captchaToken) {
      setMessage({ text: AUTH_MSG.captchaIncomplete, type: "error" });
      return;
    }

    setResending(true);
    setMessage({ text: "", type: "" });

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: sessionEmail,
        options: { captchaToken },
      });
      if (error) {
        const err = new Error(error.message || "");
        err.code = error.code || "";
        throw err;
      }
      setMessage({
        text: "Verification code sent again. It can take a minute to arrive.",
        type: "success",
      });
      setCountdown(RESEND_COOLDOWN_SECONDS);
      // Turnstile tokens are single-use and /resend already consumed this one.
      // The widget stays mounted across resends, so a success MUST also hand
      // the next attempt a fresh challenge — otherwise the 60 s-later resend
      // would replay the spent token and GoTrue would reject it as
      // timeout-or-duplicate ("The security check failed").
      captchaRef.current?.reset();
    } catch (err) {
      // The account already exists at this point, so a provider failure is
      // reported with the contextual message — never as an invalid address.
      //
      // Turnstile tokens are single-use: /resend's middleware already spent
      // this one, so ANY failure (CAPTCHA rejection, rate limit, connectivity)
      // hands the retry a fresh challenge instead of a doomed replay.
      captchaRef.current?.reset();
      setMessage({
        text: messageForCode(err.code || "", err.message || "", { accountCreated: true }),
        type: "error",
      });
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (e) => {
    // Shape only: digits, at most six. The server decides correctness.
    setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH));
  };

  const handleVerify = async (event) => {
    event?.preventDefault?.();
    const code = otp.replace(/\s/g, "");
    if (loading || resending || verified) return;
    if (!sessionEmail) return;
    if (code.length !== OTP_LENGTH) {
      setMessage({ text: AUTH_MSG.otpIncomplete, type: "error" });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      // Snapshot any unrelated signed-in account BEFORE verifyOtp: a
      // successful verification creates a session for the address being
      // verified, which would otherwise silently replace it.
      const { data: beforeData } = await supabase.auth.getSession();
      const beforeSession = beforeData?.session || null;
      const selfEmail = sessionEmail.toLowerCase();
      const foreignSession =
        beforeSession &&
        beforeSession.access_token &&
        (beforeSession.user?.email || "").toLowerCase() !== selfEmail
          ? beforeSession
          : null;

      // Server-side validation — the only thing that can confirm the
      // address. No local check, no stored copy of the code, ever.
      const { error } = await supabase.auth.verifyOtp({
        email: sessionEmail,
        token: code,
        type: "signup",
      });
      if (error) {
        const err = new Error(error.message || "");
        err.code = error.code || "";
        err.status = error.status || 0;
        throw err;
      }

      // The address is confirmed. verifyOtp() just created a session, and
      // that session is exactly what AuthContext needs to create the profile
      // row (the pendingSignup marker is consumed there, and only when the
      // row really exists — otherwise it stays for the login-time retry).
      try {
        await refreshSession();
      } catch {
        // Adoption then happens after the manual sign-in instead.
      }
      clearPendingEmail();

      // Verification never signs anyone in: release the session verifyOtp
      // just created, then put back any unrelated account that was signed
      // in on this device before (its tokens were snapshotted above; the
      // verify session replaced it in storage).
      await signOutLocalWithRetries(supabase.auth);
      if (foreignSession) {
        try {
          await supabase.auth.setSession({
            access_token: foreignSession.access_token,
            refresh_token: foreignSession.refresh_token,
          });
        } catch {
          // The other account could not be restored — nothing is signed in,
          // which a plain password sign-in fixes anyway.
        }
      }

      // The last word is always what is actually in storage. If OUR session
      // survived signOut entirely, a plain SPA navigate could keep it alive
      // (auto-refresh and all): wipe the persisted keys and start clean
      // with a full reload instead. Navigation state cannot survive that,
      // so the success message rides in the one-shot flash.
      const { data: afterData } = await supabase.auth.getSession();
      const remainingEmail = (afterData?.session?.user?.email || "").toLowerCase();
      if (remainingEmail === selfEmail) {
        clearStoredAuthKeys();
        writeLoginFlash(sessionEmail);
        try {
          window.location.replace("/login");
        } catch {
          // Blocked navigation (e.g. test environment) — the flash still
          // reaches /login on the next load.
        }
        return;
      }

      navigate("/login", {
        replace: true,
        state: {
          notice: AUTH_MSG.verifiedSuccess,
          noticeType: "success",
          email: sessionEmail,
        },
      });
    } catch (err) {
      const text = messageForVerifyError(err);
      if (text === AUTH_MSG.alreadyVerified) {
        // GoTrue says the address is already confirmed — there is nothing
        // left to verify, and nothing here created a session to release.
        // Send the user to sign in with the reason instead of letting them
        // retype a code that can never succeed.
        clearPendingEmail();
        navigate("/login", {
          replace: true,
          state: { notice: AUTH_MSG.alreadyVerified, email: sessionEmail },
        });
        return;
      }
      setMessage({ text, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDifferentEmail = async () => {
    clearPendingEmail();
    clearPendingSignup();
    clearVerifiedNotice();
    setMessage({ text: "", type: "" });
    try {
      await supabase.auth.signOut();
    } catch {
      // Nothing to sign out of.
    }
    navigate("/signup", { replace: true });
  };

  // --- Auth still settling: show a spinner and DO NOT redirect. -------------
  if (pageState === "loading" && !verified) {
    return (
      <div style={pageWrapper}>
        <div style={card}>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
          <h2 style={title}>Verify Your Email</h2>
          <p style={{ ...subtitle, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <span style={{
              display: "inline-block", width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.2)",
              borderTopColor: "#93c5fd", borderRadius: "50%", animation: "spin 0.6s linear infinite",
            }} />
            Checking your session...
          </p>
        </div>
      </div>
    );
  }

  // --- No session and no remembered address: tell them, do not loop. -------
  if (pageState === "login-again" && !verified) {
    return (
      <div style={pageWrapper}>
        <div style={card}>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
          <h2 style={title}>Verify Your Email</h2>
          <p style={{ ...subtitle, marginBottom: "20px" }}>{AUTH_MSG.loginAgain}</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: "24px" }}>
            Sign up again and we&apos;ll send a fresh verification email.
          </p>
          <button
            onClick={() => navigate("/signup", { replace: true })}
            style={{
              width: "100%", padding: "12px", borderRadius: "12px", border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #4a90e2, #3b82f6)", color: "#fff",
              fontSize: "15px", fontWeight: "700",
            }}
          >
            Go to Sign Up
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapper}>
      <div style={{ ...blobStyle, width: "350px", height: "350px", background: "#4a90e2", top: "-5%", right: "-5%" }} />
      <div style={{ ...blobStyle, width: "250px", height: "250px", background: "#a78bfa", bottom: "-5%", left: "-5%" }} />

      <div style={card}>
        {/* Success overlay */}
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(15, 23, 42, 0.95)", backdropFilter: "blur(20px)",
          borderRadius: "24px", opacity: verified ? 1 : 0,
          pointerEvents: verified ? "auto" : "none", transition: "opacity 0.5s ease",
          zIndex: 10, padding: "40px",
        }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="30" fill="none" stroke="#22c55e" strokeWidth="3"
              style={{ strokeDasharray: 188.5, strokeDashoffset: verified ? 0 : 188.5, transition: "stroke-dashoffset 0.6s ease 0.2s" }} />
            <polyline points="20,32 28,40 44,24" fill="none" stroke="#22c55e" strokeWidth="3"
              style={{ strokeDasharray: 34, strokeDashoffset: verified ? 0 : 34, transition: "stroke-dashoffset 0.6s ease 0.7s" }} />
          </svg>
          <h2 style={{
            margin: "16px 0 0", color: "#fff", fontSize: "22px", fontWeight: "700",
            transform: verified ? "translateY(0)" : "translateY(12px)",
            opacity: verified ? 1 : 0, transition: "all 0.5s ease 0.6s",
          }}>Email Verified!</h2>
          <p style={{
            color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "8px 0 0",
            transform: verified ? "translateY(0)" : "translateY(12px)",
            opacity: verified ? 1 : 0, transition: "all 0.5s ease 0.75s",
          }}>
            {noticeDriven ? "You can now sign in to your account." : "Redirecting to your dashboard..."}
          </p>
          {noticeDriven && (
            <button
              onClick={() =>
                navigate("/login", {
                  replace: true,
                  state: {
                    notice: AUTH_MSG.verifiedSuccess,
                    noticeType: "success",
                    ...(verifiedNotice?.email ? { email: verifiedNotice.email } : {}),
                  },
                })
              }
              style={{
                marginTop: "20px", padding: "12px 32px", borderRadius: "10px",
                border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #4a90e2, #3b82f6)", color: "#fff",
                fontSize: "15px", fontWeight: "700",
                transform: verified ? "translateY(0)" : "translateY(12px)",
                opacity: verified ? 1 : 0, transition: "all 0.5s ease 0.85s",
              }}
            >
              Sign In
            </button>
          )}
        </div>

        <div style={{ fontSize: "42px", marginBottom: "8px" }}>✉️</div>
        <h2 style={title}>Verify Your Email</h2>
        <p style={subtitle}>
          Enter the 6-digit code we sent to<br />
          <strong style={{ color: "#93c5fd" }}>{sessionEmail}</strong>
        </p>

        {navState.accountCreated && (
          <div style={{
            padding: "10px 12px", borderRadius: "10px", marginBottom: "16px", fontSize: "12px",
            backgroundColor: "rgba(74,144,226,0.15)", border: "1px solid rgba(74,144,226,0.3)",
            color: "#93c5fd", textAlign: "center",
          }}>
            Your account has been created — just one step left to go.
          </div>
        )}

        <div style={{
          padding: "12px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px",
          backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 1.6,
        }}>
          Open that email and type the code below to confirm this address.
          You&apos;ll sign in with your password right after.
        </div>

        {message.text && (
          <div style={{
            padding: "12px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px",
            backgroundColor: message.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${message.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: message.type === "success" ? "#86efac" : "#fca5a5",
            textAlign: "center", fontWeight: "600",
          }}>
            {message.type === "success" ? "✅ " : "⚠️ "}{message.text}
          </div>
        )}

        <form onSubmit={handleVerify} noValidate>
          <div style={inputWrapper}>
            <span style={inputIcon}>🔢</span>
            <input
              style={{ ...input, letterSpacing: "0.5em", textAlign: "center", paddingLeft: "38px" }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              placeholder="123456"
              aria-label="Verification code"
              value={otp}
              onChange={handleOtpChange}
              disabled={loading || resending || verified}
            />
          </div>

          <button
            type="submit"
            disabled={loading || resending || verified}
            style={{
              width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "12px",
              border: "none", cursor: loading ? "not-allowed" : "pointer",
              background: "linear-gradient(135deg, #4a90e2, #3b82f6)", color: "#fff",
              fontSize: "15px", fontWeight: "700", opacity: loading ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            {loading && (
              <span style={{
                display: "inline-block", width: "16px", height: "16px",
                border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
                borderRadius: "50%", animation: "spin 0.6s linear infinite",
              }} />
            )}
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <TurnstileWidget ref={captchaRef} />
          {countdown > 0 ? (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
              Resend code in <strong style={{ color: "#93c5fd" }}>{countdown}s</strong>
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending || loading}
              style={{
                background: "none", border: "none", color: "#93c5fd", cursor: "pointer",
                fontSize: "13px", fontWeight: "600", textDecoration: "underline",
                opacity: resending ? 0.6 : 1,
              }}
            >
              {resending ? "Sending..." : "Resend verification code"}
            </button>
          )}
        </div>

        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textAlign: "center", marginBottom: "16px" }}>
          Check your spam folder if you don&apos;t see the email.
        </p>

        <button
          onClick={handleDifferentEmail}
          style={{
            width: "100%", padding: "10px", background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px",
            color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "13px",
          }}
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}

const blobStyle = {
  position: "absolute",
  borderRadius: "50%",
  filter: "blur(80px)",
  opacity: 0.15,
  pointerEvents: "none",
};
