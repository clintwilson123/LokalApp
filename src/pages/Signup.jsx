import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon, button, linkHighlight } from "../uiStyles";
import { sanitizeName, validateGmail, getPasswordStrength, maxLength } from "../lib/sanitize";
import { AUTH_MSG, messageForCode } from "../lib/authErrors";

const bgBlob = {
  position: "absolute", borderRadius: "50%", filter: "blur(80px)",
  opacity: 0.15, pointerEvents: "none", zIndex: 1,
};

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

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

async function verifyCaptcha(email, token) {
  return invokeEdge("spam-prevention", { email, captchaToken: token });
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
  // ACCOUNT_CREATION_FAILED vs ACCOUNT_CREATED_VERIFICATION_PENDING are distinct
  // states. Once signUp() hands back a user, a later OTP/delivery failure is
  // reported as a pending verification — never as a failed signup.
  const [accountCreated, setAccountCreated] = useState(false);
  // Synchronous submit guard: `loading` is state and will not have re-rendered
  // when two Enter keydowns arrive in the same event cycle.
  const submittingRef = useRef(false);

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
    if (submittingRef.current) return;

    setError("");
    if (!fullName.trim() || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    // 1) Validate email format BEFORE any network calls
    const gmailCheck = validateGmail(email);
    if (!gmailCheck.valid) {
      // Format issues → format message; heuristic risk → suspicious-activity
      // message. Heuristics never claim the address cannot receive mail.
      if (gmailCheck.code === "HIGH_RISK") {
        setError(AUTH_MSG.suspicious);
      } else {
        setError(AUTH_MSG.invalidFormat);
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

    submittingRef.current = true;
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

      // Account creation. Once this returns a user, the account EXISTS — every
      // failure below is a pending verification, never a failed signup.
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
      const accountEmail = signupResult.user.email || email;

      // Attempt the OTP. A delivery failure must NOT roll the account back and
      // must NOT send the user back to Signup — it is carried to /verify-email
      // as state and shown there as "account created, email still pending".
      let deliveryFailed = false;
      try {
        await invokeEdge("send-verification-code", { email: accountEmail });
      } catch {
        deliveryFailed = true;
      }

      // The session created by signUp() is kept so the user lands on
      // /verify-email already authenticated and can enter or resend the code.
      navigate("/verify-email", {
        replace: true,
        state: { email: accountEmail, accountCreated: true, deliveryFailed },
      });
    } catch (err) {
      // Only errors raised by our Edge Functions carry an app error code.
      // Everything else (Supabase auth / PostgREST) is classified without one.
      const edgeCode = err?.source === "edge" ? err.code || "" : "";
      setError(messageForCode(edgeCode, err?.message || ""));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleSignup();
    }
  };

  return (
    <div style={pageWrapper}>
      <div style={{ ...bgBlob, width: "350px", height: "350px", background: "#4a90e2", top: "-5%", right: "-5%" }} />
      <div style={{ ...bgBlob, width: "250px", height: "250px", background: "#a78bfa", bottom: "-5%", left: "-5%" }} />
      <div style={{ ...bgBlob, width: "180px", height: "180px", background: "#22c55e", top: "40%", left: "60%", transform: "translate(-50%, -50%)" }} />

      <div style={card}>
        <div>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>🚀</div>
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
      </div>
    </div>
  );
}

const checkboxLabel = {
  display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px",
  color: "rgba(255,255,255,0.6)", cursor: "pointer", marginBottom: "16px", textAlign: "left",
};
