import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { pageWrapper, card, title, input, button } from "../uiStyles";
import { colors } from "../uiStyles";

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError("Invalid or expired reset link. Please request a new one.");
      }
      setChecking(false);
    });
  }, []);

  const handleUpdate = async () => {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div style={pageWrapper}>
        <div style={{ ...card, maxWidth: "420px", padding: "40px" }}>
          <p style={{ color: colors.textSecondary }}>Verifying session...</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={pageWrapper}>
        <div style={{ ...card, maxWidth: "420px", padding: "40px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
          <h2 style={title}>Password Updated!</h2>
          <p style={{ color: colors.textSecondary, fontSize: "14px" }}>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapper}>
      <div style={{ ...card, maxWidth: "420px", padding: "40px" }}>
        <h2 style={title}>Set New Password</h2>
        <p style={{ color: colors.textSecondary, marginBottom: "28px", fontSize: "14px" }}>
          Choose a new password for your account.
        </p>

        {error && (
          <p style={{ color: colors.danger, fontSize: "13px", marginBottom: "12px", background: "#fee2e2", padding: "10px", borderRadius: "8px" }}>
            {error}
          </p>
        )}

        <input
          style={input}
          type="password"
          placeholder="New password (min. 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          style={{ ...button, width: "100%", marginTop: "8px", opacity: loading ? 0.7 : 1 }}
          onClick={handleUpdate}
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}
