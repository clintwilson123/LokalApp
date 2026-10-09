import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { pageWrapper, card, title, subtitle } from "../uiStyles";
import { AUTH_MSG, messageForCode } from "../lib/authErrors";
import { verifyPageState, dashboardPathFor, roleOf } from "../lib/authFlow";
import { isTurnstileConfigured } from "../lib/turnstile";
import TurnstileWidget from "../components/TurnstileWidget";
import {
  readPendingEmail,
  clearPendingEmail,
  clearPendingSignup,
} from "../lib/pendingVerification";

// Supabase throttles resends itself; this mirrors its 60 s floor so the button
// is honest rather than racing the server into an over_email_send_rate_limit.
const RESEND_COOLDOWN_SECONDS = 60;

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
  // Turnstile handle for the resend action: /resend is captcha-protected once
  // the Dashboard toggle is enabled.
  const captchaRef = useRef(null);

  const pageState = verifyPageState({
    loading: authLoading,
    user,
    profile,
    pendingEmail: sessionEmail,
  });

  // Resend cooldown.
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Supabase Auth confirmed the address (the link landed here, or in another
  // tab and this one picked it up from storage). Show the success state, then
  // hand off to the dashboard for this user's role — never back to /login.
  useEffect(() => {
    if (pageState !== "already-verified") return;
    setVerified(true);
    const timer = setTimeout(() => {
      navigate(dashboardPathFor(roleOf(profile, user)), { replace: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [pageState, profile, user, navigate]);

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
        text: "Confirmation email sent again. It can take a minute to arrive.",
        type: "success",
      });
      setCountdown(RESEND_COOLDOWN_SECONDS);
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

  // The confirmation link was opened somewhere else (email clients like to use
  // a new tab). Re-read the session from storage, sync the profile and let the
  // effect above redirect once the state settles.
  const handleConfirmed = async () => {
    if (loading || resending || verified) return;
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const fresh = await refreshSession();
      if (fresh?.email_confirmed_at) {
        return; // pageState becomes "already-verified" and the effect navigates
      }
      setMessage({
        text: "We haven't picked up the confirmation yet. Click the link in your email, then try again.",
        type: "error",
      });
    } catch {
      setMessage({ text: AUTH_MSG.network, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDifferentEmail = async () => {
    clearPendingEmail();
    clearPendingSignup();
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
            Sign up again and we&apos;ll send a fresh confirmation email.
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
          }}>Redirecting to your dashboard...</p>
        </div>

        <div style={{ fontSize: "42px", marginBottom: "8px" }}>✉️</div>
        <h2 style={title}>Verify Your Email</h2>
        <p style={subtitle}>
          We sent a confirmation link to<br />
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
          Open that email and click <strong style={{ color: "#93c5fd" }}>Confirm your email address</strong>.
          You&apos;ll come straight back here once it&apos;s done.
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

        <button
          onClick={handleConfirmed}
          disabled={loading || resending}
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
          {loading ? "Checking..." : "I've confirmed my email"}
        </button>

        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <TurnstileWidget ref={captchaRef} />
          {countdown > 0 ? (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
              Resend link in <strong style={{ color: "#93c5fd" }}>{countdown}s</strong>
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
              {resending ? "Sending..." : "Resend confirmation email"}
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
