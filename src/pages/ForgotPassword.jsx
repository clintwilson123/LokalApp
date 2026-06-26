import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { pageWrapper, card, title, input, button } from "../uiStyles";
import { colors } from "../uiStyles";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setError("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div style={pageWrapper}>
        <div style={{ ...card, maxWidth: "420px", padding: "40px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📧</div>
          <h2 style={title}>Check Your Email</h2>
          <p style={{ color: colors.textSecondary, fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
            We sent a password reset link to <strong>{email}</strong>. Click the link to create a new password.
          </p>
          <Link to="/login" style={{ ...button, textDecoration: "none", display: "inline-block" }}>
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapper}>
      <div style={{ ...card, maxWidth: "420px", padding: "40px" }}>
        <h2 style={title}>Reset Password</h2>
        <p style={{ color: colors.textSecondary, marginBottom: "28px", fontSize: "14px" }}>
          Enter your email and we'll send you a reset link.
        </p>

        {error && (
          <p style={{ color: colors.danger, fontSize: "13px", marginBottom: "12px", background: "#fee2e2", padding: "10px", borderRadius: "8px" }}>
            {error}
          </p>
        )}

        <input
          style={input}
          placeholder="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          style={{ ...button, width: "100%", marginTop: "8px", opacity: loading ? 0.7 : 1 }}
          onClick={handleReset}
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <p style={{ marginTop: "20px", fontSize: "14px", color: colors.textSecondary }}>
          Remember your password?{" "}
          <Link to="/login" style={{ color: colors.primaryDark, fontWeight: "600" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
