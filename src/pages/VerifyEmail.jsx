import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { pageWrapper, card, title, subtitle } from "../uiStyles";

const MSG = {
  invalidFormat: "Please enter a valid Gmail address.",
  undeliverable: "This Gmail address appears to be invalid or cannot receive emails. Please use a valid Gmail account.",
  network: "Could not reach the server. Please check your connection and try again.",
};

async function invokeEdgeForVerify(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // True connectivity failure
    if (
      error.name === "FunctionsFetchError" ||
      error.message?.includes("Failed to send a request") ||
      error instanceof TypeError
    ) {
      throw new Error(MSG.network);
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
    if (code === "INVALID_FORMAT") throw new Error(MSG.invalidFormat);
    if (code === "DELIVERY_FAILED" || code === "UNDELIVERABLE") throw new Error(MSG.undeliverable);
    if (/gmail|deliver|receive emails|invalid or cannot/i.test(bodyMsg || "")) {
      throw new Error(MSG.undeliverable);
    }
    throw new Error(bodyMsg || "Something went wrong. Please try again.");
  }
  return data;
}

export default function VerifyEmail() {
  const { user, signOut, loadProfile } = useAuth();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [countdown, setCountdown] = useState(60);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

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
      inputRefs.current[index - 1]?.focus();
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
    if (!user?.email) return;
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const data = await invokeEdgeForVerify("verify-otp-code", {
        email: user.email,
        code: codeStr,
      });

      if (!data?.success) throw new Error(data?.error || "Verification failed");

      setVerified(true);

      // Reload profile to update email_verified status
      setTimeout(async () => {
        await loadProfile(user.id);
      }, 1500);
    } catch (err) {
      setMessage({ text: err.message || "Verification failed", type: "error" });
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!user?.email || countdown > 0) return;
    setResending(true);
    setMessage({ text: "", type: "" });

    try {
      await invokeEdgeForVerify("send-verification-code", { email: user.email });
      setMessage({ text: "New code sent! Check your email.", type: "success" });
      setCountdown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setMessage({ text: err.message || "Failed to resend code", type: "error" });
    } finally {
      setResending(false);
    }
  };

  const handleLogout = () => signOut();

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
            opacity: verified ? 1 : 0, transform: verified ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.4s ease 0.6s",
          }}>Email Verified!</h2>
          <p style={{
            color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "8px 0 24px",
            opacity: verified ? 1 : 0, transform: verified ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.4s ease 0.75s",
          }}>Redirecting to your dashboard...</p>
        </div>

        <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
        <h2 style={title}>Verify Your Email</h2>
        <p style={subtitle}>
          Enter the 6-digit code sent to<br />
          <strong style={{ color: "#93c5fd" }}>{user?.email || "your email"}</strong>
        </p>

        {message.text && (
          <div style={{
            padding: "12px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px",
            backgroundColor: message.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
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
              ref={(el) => (inputRefs.current[i] = el)}
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
              disabled={resending}
              style={{
                background: "none", border: "none", color: "#93c5fd", cursor: "pointer",
                fontSize: "13px", fontWeight: "600", textDecoration: "underline",
              }}
            >
              {resending ? "Sending..." : "Resend Code"}
            </button>
          )}
        </div>

        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textAlign: "center", marginBottom: "16px" }}>
          Check your spam folder if you don't see the code.
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
  position: "absolute", borderRadius: "50%", filter: "blur(80px)",
  opacity: 0.15, pointerEvents: "none", zIndex: 1,
};
