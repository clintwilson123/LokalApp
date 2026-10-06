import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { pageWrapper, card, title, subtitle } from "../uiStyles";
import { AUTH_MSG, messageForCode } from "../lib/authErrors";
import { verifyPageState, dashboardPathFor, roleOf, LOGIN_PATH } from "../lib/authFlow";

async function invokeEdgeForVerify(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // True connectivity failure
    if (
      error.name === "FunctionsFetchError" ||
      error.message?.includes("Failed to send a request") ||
      error instanceof TypeError
    ) {
      const netErr = new Error(AUTH_MSG.network);
      netErr.code = "NETWORK";
      throw netErr;
    }
    // Prefer structured body error when available
    let payload = data;
    if (!payload && error.context && typeof error.context.json === "function") {
      try {
        payload = await error.context.json();
      } catch {
        // body already consumed
      }
    }
    if (!payload && error.message) {
      try {
        payload = JSON.parse(error.message);
      } catch {
        // not JSON
      }
    }
    const bodyMsg = payload?.error || payload?.message || error.message;
    const code = payload?.code || "";
    // Classified strictly by error code — no content-based matching.
    const err = new Error(messageForCode(code, bodyMsg));
    err.code = code;
    err.source = "edge";
    throw err;
  }
  return data;
}

export default function VerifyEmail() {
  const { user, profile, loading: authLoading, signOut, loadProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Carried from Signup so the page knows whether the first send failed.
  const navState = location.state || {};
  const deliveryFailed = navState.deliveryFailed === true;
  const stateEmail = typeof navState.email === "string" ? navState.email : "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState(() =>
    deliveryFailed
      ? { text: AUTH_MSG.emailProviderAfterCreate, type: "error" }
      : { text: "", type: "" }
  );
  const [countdown, setCountdown] = useState(60);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef([]);

  const pageState = verifyPageState({ loading: authLoading, user, profile });
  const sessionEmail = user?.email || stateEmail;

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Already verified (either arriving that way, or right after submitting the
  // code) -> leave for the correct dashboard instead of stranding the user here.
  useEffect(() => {
    if (verified) return;
    if (pageState === "already-verified") {
      navigate(dashboardPathFor(roleOf(profile, user)), { replace: true });
    }
  }, [pageState, verified, profile, user, navigate]);

  // Focus the first box only once the form is actually on screen. Never while
  // the session is still loading — that is a redirect-free state.
  useEffect(() => {
    if (pageState === "form" && !verified) {
      inputRefs.current[0]?.focus();
    }
  }, [pageState, verified]);

  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    const newCode = [...code];
    newCode[index] = value.slice(-1); // Take only last digit
    setCode(newCode);
    setMessage({ text: "", type: "" });

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const fullCode = newCode.join("");
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1].focus();
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const newCode = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
      setCode(newCode);
      // Focus the last filled input or the next empty one
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs.current[focusIndex]?.focus();
      // Auto-submit if full code pasted
      if (pasted.length === 6) {
        handleVerify(pasted);
      }
    }
  };

  const handleVerify = async (codeStr) => {
    if (loading || verified) return;
    if (!sessionEmail) return;
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const data = await invokeEdgeForVerify("verify-otp-code", {
        email: sessionEmail,
        code: codeStr,
      });

      if (!data?.success) {
        const fail = new Error(data?.error || "Verification failed");
        fail.code = data?.code || "";
        throw fail;
      }

      // The OTP succeeded — mark the screen as verified first so no later
      // render can send the user backwards, then refresh auth/profile state so
      // ProtectedRoute sees email_verified before we navigate.
      setVerified(true);
      if (user?.id) {
        try {
          await loadProfile(user.id);
        } catch {
          // Profile refresh is best effort; the OTP itself already landed.
        }
      }
      const role = roleOf(profile, user);
      setTimeout(() => navigate(dashboardPathFor(role), { replace: true }), 1400);
    } catch (err) {
      // Wrong / expired / exhausted code -> INVALID_CODE -> dedicated message.
      setMessage({
        text: messageForCode(err.code || "", err.message || "", { accountCreated: true }),
        type: "error",
      });
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    // Guard against double clicks and any second request while one is running.
    if (resending || loading || verified) return;
    if (countdown > 0 || !sessionEmail) return;
    setResending(true);
    setMessage({ text: "", type: "" });

    try {
      await invokeEdgeForVerify("send-verification-code", { email: sessionEmail });
      setMessage({ text: "New code sent! Check your email.", type: "success" });
      setCountdown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      // The account already exists at this point, so a provider failure is
      // reported with the contextual message — never as an invalid address.
      setMessage({
        text: messageForCode(err.code || "", err.message || "", { accountCreated: true }),
        type: "error",
      });
    } finally {
      setResending(false);
    }
  };

  const handleLogout = () => signOut();

  // --- Auth still settling: show a spinner and DO NOT redirect. -------------
  if (pageState === "loading") {
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

  // --- No authenticated user once loading finished: tell them, do not loop. --
  if (pageState === "login-again") {
    return (
      <div style={pageWrapper}>
        <div style={card}>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
          <h2 style={title}>Verify Your Email</h2>
          <p style={{ ...subtitle, marginBottom: "20px" }}>{AUTH_MSG.loginAgain}</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: "24px" }}>
            Sign in with the account you just created and we&apos;ll bring you
            straight back here.
          </p>
          <button
            onClick={() => navigate(LOGIN_PATH, { replace: true })}
            style={{
              width: "100%", padding: "12px", borderRadius: "12px", border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #4a90e2, #3b82f6)", color: "#fff",
              fontSize: "15px", fontWeight: "700",
            }}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // --- Already verified on arrival: notice only, the effect above navigates. --
  if (pageState === "already-verified" && !verified) {
    return (
      <div style={pageWrapper}>
        <div style={card}>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>✅</div>
          <h2 style={title}>Email Already Verified</h2>
          <p style={subtitle}>Taking you to your dashboard...</p>
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
              strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 34, strokeDashoffset: verified ? 0 : 34, transition: "stroke-dashoffset 0.4s ease 0.7s" }} />
          </svg>
          <h2 style={{
            margin: "16px 0 0", color: "#fff", fontSize: "22px", fontWeight: "700",
            transform: verified ? "translateY(0)" : "translateY(12px)",
            opacity: verified ? 1 : 0, transition: "all 0.4s ease 0.6s",
          }}>Email Verified!</h2>
          <p style={{
            color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "8px 0 0",
            transform: verified ? "translateY(0)" : "translateY(12px)",
            opacity: verified ? 1 : 0, transition: "all 0.4s ease 0.75s",
          }}>Redirecting to your dashboard...</p>
        </div>

        <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
        <h2 style={title}>Verify Your Email</h2>
        <p style={subtitle}>
          Enter the 6-digit code sent to<br />
          <strong style={{ color: "#93c5fd" }}>{sessionEmail}</strong>
        </p>

        {navState.accountCreated && !deliveryFailed && (
          <div style={{
            padding: "10px 12px", borderRadius: "10px", marginBottom: "16px", fontSize: "12px",
            backgroundColor: "rgba(74,144,226,0.15)", border: "1px solid rgba(74,144,226,0.3)",
            color: "#93c5fd", textAlign: "center",
          }}>
            Your account has been created — just one step left to go.
          </div>
        )}

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

        {/* Code inputs */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "20px" }}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              disabled={loading || verified}
              style={{
                width: "48px", height: "56px", textAlign: "center", fontSize: "22px", fontWeight: "700",
                borderRadius: "12px", border: digit ? "2px solid #4a90e2" : "2px solid rgba(255,255,255,0.15)",
                backgroundColor: digit ? "rgba(74,144,226,0.15)" : "rgba(255,255,255,0.06)",
                color: "#fff", outline: "none", fontFamily: "monospace",
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>

        {loading && (
          <p style={{ fontSize: "13px", color: "#93c5fd", textAlign: "center", marginBottom: "16px" }}>
            Verifying...
          </p>
        )}

        {/* Resend button */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
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
              {resending ? "Sending..." : "Resend Code"}
            </button>
          )}
        </div>

        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textAlign: "center", marginBottom: "16px" }}>
          Check your spam folder if you don&apos;t see the code.
        </p>

        <button
          onClick={handleLogout}
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
