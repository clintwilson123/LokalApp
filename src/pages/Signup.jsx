import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon, button, linkHighlight, radii } from "../uiStyles";
import { sanitizeName, validateGmail, getPasswordStrength, maxLength } from "../lib/sanitize";

const bgBlob = {
  position: "absolute", borderRadius: "50%", filter: "blur(80px)",
  opacity: 0.15, pointerEvents: "none", zIndex: 1,
};

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

const MSG = {
  invalidFormat: "Please enter a valid Gmail address.",
  undeliverable: "This Gmail address appears to be invalid or cannot receive emails. Please use a valid Gmail account.",
  network: "Could not reach the server. Please check your connection and try again.",
};

// Extract a safe, user-facing error from a supabase.functions.invoke error
async function extractEdgeError(error) {
  // Network / fetch failure — true connectivity issue
  if (
    error?.name === "FunctionsFetchError" ||
    error?.message?.includes("Failed to send a request") ||
    error instanceof TypeError
  ) {
    return { message: MSG.network, code: "NETWORK" };
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

  return { message: raw || MSG.network, code: "UNKNOWN" };
}

// Map known codes/messages to the three allowed user-facing messages
function toUserMessage(code, message) {
  if (code === "NETWORK") return MSG.network;
  if (code === "INVALID_FORMAT") return MSG.invalidFormat;
  if (
    code === "UNDELIVERABLE" ||
    code === "DELIVERY_FAILED" ||
    /gmail|deliver|receive emails|invalid or cannot/i.test(message || "")
  ) {
    return MSG.undeliverable;
  }
  if (code === "ALREADY_REGISTERED" || /already registered|duplicate/i.test(message || "")) {
    return "This email is already registered. Try signing in instead.";
  }
  if (code === "RATE_LIMITED" || /rate limit/i.test(message || "")) {
    return "Too many signups. Please wait a moment and try again.";
  }
  if (code === "HIGH_RISK" || /Risk indicators|blocked|suspicious/i.test(message || "")) {
    return MSG.undeliverable;
  }
  if (code === "CAPTCHA_FAILED" || code === "SERVER_ERROR") {
    return "Something went wrong. Please try again.";
  }
  // Unknown server messages — show a safe generic fallback, never internals
  if (code && code !== "UNKNOWN") return message;
  return message || "Something went wrong. Please try again.";
}

async function invokeEdge(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const extracted = await extractEdgeError(error);
    const err = new Error(toUserMessage(extracted.code, extracted.message));
    err.code = extracted.code;
    throw err;
  }
  return data;
}

async function verifyCaptcha(email, token) {
  return invokeEdge("spam-prevention", { email, captchaToken: token });
}

// Best-effort cleanup if OTP was never delivered — remove the unverified account
async function rollbackSignup(email) {
  try {
    await supabase.functions.invoke("cleanup-unverified-signup", {
      body: { email },
    });
  } catch {
    // Cleanup is best-effort; unverified accounts cannot sign in anyway
  }
}

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Dynamically load reCAPTCHA script if key is configured
  useEffect(() => {
    if (RECAPTCHA_SITE_KEY && !document.querySelector(`script[src*="recaptcha"]`)) {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const strength = getPasswordStrength(password);

  const handleSignup = async () => {
    setError("");
    if (!fullName.trim() || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    // 1) Validate email format BEFORE any network calls
    const gmailCheck = validateGmail(email);
    if (!gmailCheck.valid) {
      // Format issues → format message; strong undeliverable risk → delivery message
      if (gmailCheck.code === "UNDELIVERABLE") {
        setError(MSG.undeliverable);
      } else {
        setError(MSG.invalidFormat);
      }
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
      setError("You must agree to the terms to create an account.");
      return;
    }
    setLoading(true);
    try {
      // Spam prevention — hard gate (also re-validates format/risk server-side)
      let captchaToken = null;
      if (RECAPTCHA_SITE_KEY && typeof window !== "undefined" && window.grecaptcha) {
        try {
          captchaToken = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "signup" });
        } catch {
          // Captcha failed — continue without token, server will decide
        }
      }

      const spamResult = await verifyCaptcha(email, captchaToken);
      const riskLevel = spamResult?.risk_level || "low";

      // 2) Create account (unverified — cannot sign in until OTP verified)
      await signUp(email, password, maxLength(sanitizeName(fullName), 100), "applicant", riskLevel);

      // 3) Send OTP — must succeed before we continue
      try {
        await invokeEdge("send-verification-code", { email });
      } catch (otpErr) {
        // OTP not delivered → do not keep the account (cleanup needs the
        // session created by signUp, so sign out only after it runs)
        await rollbackSignup(email);
        await supabase.auth.signOut();
        throw otpErr;
      }

      // Signed out only now so cleanup-unverified-signup could authenticate;
      // the user must still verify their email and log in
      await supabase.auth.signOut();
      setSuccess(true);
    } catch (err) {
      const msg = err?.message || "";
      const code = err?.code || "";

      if (code === "NETWORK" || msg === MSG.network) {
        setError(MSG.network);
      } else if (code === "INVALID_FORMAT" || msg === MSG.invalidFormat) {
        setError(MSG.invalidFormat);
      } else if (
        code === "UNDELIVERABLE" ||
        code === "DELIVERY_FAILED" ||
        msg === MSG.undeliverable ||
        /gmail|deliver|receive emails|invalid or cannot/i.test(msg)
      ) {
        setError(MSG.undeliverable);
      } else if (msg.includes("already registered") || msg.includes("duplicate")) {
        setError("This email is already registered. Try signing in instead.");
      } else if (msg.includes("rate limit")) {
        setError("Too many signups. Please wait a moment and try again.");
      } else if (msg.includes("Risk indicators") || msg.includes("blocked")) {
        setError(MSG.undeliverable);
      } else {
        // Never expose raw internal errors / stack traces
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSignup();
  };

  return (
    <div style={pageWrapper}>
      <div style={{ ...bgBlob, width: "350px", height: "350px", background: "#4a90e2", top: "-5%", right: "-5%" }} />
      <div style={{ ...bgBlob, width: "250px", height: "250px", background: "#a78bfa", bottom: "-5%", left: "-5%" }} />
      <div style={{ ...bgBlob, width: "180px", height: "180px", background: "#22c55e", top: "40%", left: "60%", transform: "translate(-50%, -50%)" }} />

      <div style={card}>
        <div style={{ opacity: success ? 0 : 1, transition: "opacity 0.35s ease" }}>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>🚀</div>
          <h2 style={title}>Create Account</h2>
          <p style={subtitle}>Join CJLink and start your journey</p>

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
            <span>I agree to the <Link to="/consent" style={{ color: "#93c5fd" }}>Terms, Privacy Policy, and Employer Consent</Link></span>
          </label>

          <button
            style={{ ...button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
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

        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(15, 23, 42, 0.95)", backdropFilter: "blur(20px)",
          borderRadius: radii.xxl, opacity: success ? 1 : 0,
          pointerEvents: success ? "auto" : "none", transition: "opacity 0.5s ease",
          zIndex: 10, padding: "40px",
        }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="30" fill="none" stroke="#4a90e2" strokeWidth="3"
              style={{ strokeDasharray: 188.5, strokeDashoffset: success ? 0 : 188.5, transition: "stroke-dashoffset 0.6s ease 0.2s" }} />
            <polyline points="20,32 28,40 44,24" fill="none" stroke="#4a90e2" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 34, strokeDashoffset: success ? 0 : 34, transition: "stroke-dashoffset 0.4s ease 0.7s" }} />
          </svg>
          <h2 style={{
            margin: "16px 0 0", color: "#fff", fontSize: "22px", fontWeight: "700",
            transform: success ? "translateY(0)" : "translateY(12px)",
            opacity: success ? 1 : 0, transition: "all 0.4s ease 0.6s",
          }}>Account Created!</h2>
          <p style={{
            color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "8px 0 24px",
            transform: success ? "translateY(0)" : "translateY(12px)",
            opacity: success ? 1 : 0, transition: "all 0.4s ease 0.75s",
          }}>Check your email to verify your account.</p>
          <button
            style={{
              ...button,
              transform: success ? "translateY(0) scale(1)" : "translateY(12px) scale(0.96)",
              opacity: success ? 1 : 0, transition: "all 0.4s ease 0.9s",
            }}
            onClick={() => navigate("/login", { replace: true })}
          >Go to Sign In</button>
        </div>
      </div>
    </div>
  );
}

const checkboxLabel = {
  display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px",
  color: "rgba(255,255,255,0.6)", cursor: "pointer", marginBottom: "16px", textAlign: "left",
};
