import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon, button, linkHighlight } from "../uiStyles";

const bgBlob = {
  position: "absolute", borderRadius: "50%", filter: "blur(80px)",
  opacity: 0.15, pointerEvents: "none", zIndex: 1,
};

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    setError("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (resetErr) throw resetErr;
      setSent(true);
    } catch (err) {
      setError(err.message || "Failed to send reset email. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleReset();
  };

  if (sent) {
    return (
      <div style={pageWrapper}>
        <div style={{ ...bgBlob, width: "350px", height: "350px", background: "#22c55e", top: "-5%", right: "-5%" }} />
        <div style={{ ...bgBlob, width: "200px", height: "200px", background: "#4a90e2", bottom: "-5%", left: "-5%" }} />
        <div style={card}>
          <div style={{ fontSize: "56px", marginBottom: "8px" }}>📧</div>
          <h2 style={title}>Check Your Email</h2>
          <p style={subtitle}>
            We sent a password reset link to<br />
            <strong style={{ color: "#93c5fd" }}>{email}</strong>
          </p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "20px" }}>
            Click the link in the email to reset your password. Check your spam folder if you don't see it.
          </p>
          <Link to="/login" style={{ ...button, textDecoration: "none", display: "inline-block" }}>
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

      <div style={card}>
        <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
        <h2 style={title}>Reset Password</h2>
        <p style={subtitle}>Enter your email to receive a reset link</p>

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

        <button
          style={{ ...button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          onClick={handleReset}
          disabled={loading}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              Sending...
            </span>
          ) : "Send Reset Link"}
        </button>

        <p style={{ marginTop: "24px", fontSize: "14px", color: "rgba(255, 255, 255, 0.5)" }}>
          Remember your password?{" "}
          <Link to="/login" style={linkHighlight}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
