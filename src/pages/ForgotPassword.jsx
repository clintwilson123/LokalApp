import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon, button, linkHighlight } from "../uiStyles";

const bgBlob = {
  position: "absolute",
  borderRadius: "50%",
  filter: "blur(80px)",
  opacity: 0.15,
  pointerEvents: "none",
  zIndex: 1,
};

const steps = ["Phone", "Code", "Password"];

export default function ForgotPassword() {
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const devCodeRef = useRef(null);

  const maskPhone = (p) => {
    if (p.length < 4) return p;
    return p.slice(0, 3) + "***" + p.slice(-2);
  };

  const startCooldown = () => {
    setCooldown(30);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    setError("");
    if (!phone) {
      setError("Please enter your phone number.");
      return;
    }
    setLoading(true);

    const { data, error: rpcErr } = await supabase.rpc("send_reset_code", {
      p_phone: phone,
    });
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      devCodeRef.current = data;
      setStep(1);
      startCooldown();
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    setCode("");
    setLoading(true);

    const { data, error: rpcErr } = await supabase.rpc("send_reset_code", {
      p_phone: phone,
    });
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      devCodeRef.current = data;
      startCooldown();
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setError("");
    if (!code || code.length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    setLoading(true);

    const { error: rpcErr } = await supabase.rpc("verify_reset_code", {
      p_phone: phone,
      p_code: code,
    });
    if (rpcErr) {
      setError(rpcErr.message || "Invalid code. Try again.");
    } else {
      setStep(2);
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    setError("");
    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);

    const { error: rpcErr } = await supabase.rpc("reset_with_code", {
      p_phone: phone,
      p_code: code,
      p_new_password: newPassword,
    });
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      setDone(true);
    }
    setLoading(false);
  };

  const handleKeyDown = (handler) => (e) => {
    if (e.key === "Enter") handler();
  };

  if (done) {
    return (
      <div style={pageWrapper}>
        <div style={{ ...bgBlob, width: "350px", height: "350px", background: "#22c55e", top: "-5%", right: "-5%" }} />
        <div style={{ ...bgBlob, width: "200px", height: "200px", background: "#4a90e2", bottom: "-5%", left: "-5%" }} />
        <div style={card}>
          <div style={{ fontSize: "56px", marginBottom: "8px" }}>✅</div>
          <h2 style={title}>Password Reset!</h2>
          <p style={subtitle}>Your password has been updated successfully.</p>
          <Link to="/login" style={{ ...button, textDecoration: "none", display: "inline-block", marginTop: "8px" }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapper}>
      <div style={{ ...bgBlob, width: "350px", height: "350px", background: "#a78bfa", top: "-5%", right: "-5%" }} />
      <div style={{ ...bgBlob, width: "250px", height: "250px", background: "#4a90e2", bottom: "-5%", left: "-5%" }} />
      <div style={{ ...bgBlob, width: "180px", height: "180px", background: "#22c55e", top: "40%", left: "60%", transform: "translate(-50%, -50%)" }} />

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "28px" }}>
          {steps.map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: "700",
                background: i <= step ? "linear-gradient(135deg, #4a90e2, #1a73e8)" : "rgba(255,255,255,0.1)",
                color: i <= step ? "#fff" : "rgba(255,255,255,0.4)",
                border: i <= step ? "none" : "1px solid rgba(255,255,255,0.15)",
                transition: "all 0.3s ease",
              }}>
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  width: "24px", height: "2px",
                  background: i < step ? "#4a90e2" : "rgba(255,255,255,0.1)",
                  transition: "background 0.3s ease",
                }} />
              )}
            </div>
          ))}
        </div>

        <h2 style={title}>
          {step === 0 && "Reset Password"}
          {step === 1 && "Enter Code"}
          {step === 2 && "New Password"}
        </h2>
        <p style={subtitle}>
          {step === 0 && "Enter your phone number to receive a verification code."}
          {step === 1 && `We sent a code to ${maskPhone(phone)}.`}
          {step === 2 && "Choose a new password for your account."}
        </p>

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
            whiteSpace: "pre-line",
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {step === 1 && devCodeRef.current && (
          <div style={{
            background: "rgba(74, 144, 226, 0.12)",
            border: "1px dashed rgba(74, 144, 226, 0.4)",
            color: "#93c5fd",
            fontSize: "13px",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "16px",
            textAlign: "center",
          }}>
            For testing: your code is <strong style={{ fontSize: "20px", letterSpacing: "4px" }}>{devCodeRef.current}</strong>
          </div>
        )}

        {step === 0 && (
          <>
            <div style={inputWrapper}>
              <span style={inputIcon}>📱</span>
              <input
                style={input}
                placeholder="Phone number (e.g. 09171234567)"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={handleKeyDown(handleSendCode)}
              />
            </div>
            <button
              style={{ ...button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              onClick={handleSendCode}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                  Sending...
                </span>
              ) : (
                "Send Verification Code"
              )}
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={inputWrapper}>
              <span style={inputIcon}>🔢</span>
              <input
                style={input}
                placeholder="6-digit code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={handleKeyDown(handleVerifyCode)}
              />
            </div>
            <button
              style={{ ...button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              onClick={handleVerifyCode}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                  Verifying...
                </span>
              ) : (
                "Verify Code"
              )}
            </button>
            <button
              style={{
                ...button, marginTop: "10px",
                background: "transparent",
                boxShadow: "none",
                border: "1px solid rgba(255,255,255,0.15)",
                opacity: cooldown > 0 ? 0.5 : 1,
                cursor: cooldown > 0 ? "not-allowed" : "pointer",
              }}
              onClick={handleResend}
              disabled={loading || cooldown > 0}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={inputWrapper}>
              <span style={inputIcon}>🔑</span>
              <input
                style={input}
                type="password"
                placeholder="New password (min. 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={handleKeyDown(handleResetPassword)}
              />
            </div>
            <div style={inputWrapper}>
              <span style={inputIcon}>✓</span>
              <input
                style={input}
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown(handleResetPassword)}
              />
            </div>
            <button
              style={{ ...button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              onClick={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                  Resetting...
                </span>
              ) : (
                "Reset Password"
              )}
            </button>
          </>
        )}

        <p style={{ marginTop: "24px", fontSize: "14px", color: "rgba(255, 255, 255, 0.5)" }}>
          Remember your password?{" "}
          <Link to="/login" style={linkHighlight}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
