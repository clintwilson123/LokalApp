import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon, button } from "../uiStyles";

const bgBlob = {
  position: "absolute",
  borderRadius: "50%",
  filter: "blur(80px)",
  opacity: 0.15,
  pointerEvents: "none",
  zIndex: 1,
};

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let listener = null;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session) {
        setChecking(false);
        return;
      }

      const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (newSession && !cancelled) {
            setChecking(false);
          }
        }
      });
      listener = authListener;

      setTimeout(() => {
        if (!cancelled) {
          setChecking(false);
          setError("Invalid or expired reset link. Please request a new one.");
        }
      }, 5000);
    }

    init();

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const handleUpdate = async () => {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Session expired. Please request a new reset link.");
      setLoading(false);
      return;
    }

    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleUpdate();
  };

  if (checking) {
    return (
      <div style={pageWrapper}>
        <div style={card}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Verifying session...</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={pageWrapper}>
        <div style={{ ...bgBlob, width: "300px", height: "300px", background: "#22c55e", top: "-5%" }} />
        <div style={card}>
          <div style={{ fontSize: "56px", marginBottom: "8px" }}>✅</div>
          <h2 style={title}>Password Updated!</h2>
          <p style={subtitle}>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapper}>
      <div style={{ ...bgBlob, width: "350px", height: "350px", background: "#4a90e2", top: "-5%", right: "-5%" }} />
      <div style={{ ...bgBlob, width: "200px", height: "200px", background: "#a78bfa", bottom: "-5%", left: "-5%" }} />

      <div style={card}>
        <h2 style={title}>Set New Password</h2>
        <p style={subtitle}>Choose a new password for your account.</p>

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
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div style={inputWrapper}>
          <span style={inputIcon}>🔑</span>
          <input
            style={input}
            type="password"
            placeholder="New password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
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
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          style={{ ...button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          onClick={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              Updating...
            </span>
          ) : (
            "Update Password"
          )}
        </button>
      </div>
    </div>
  );
}
