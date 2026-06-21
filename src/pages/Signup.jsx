import { useState } from "react";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { pageWrapper, card, title, input, button } from "../uiStyles";
import { colors } from "../uiStyles";

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp } = useAuth();

  const role = location.state?.role || "applicant";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (role === "admin") {
    return <Navigate to="/login" state={{ role: "admin" }} replace />;
  }

  const handleSignup = async () => {
    setError("");
    if (!fullName || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, fullName, role);
      setSuccess(true);
    } catch (err) {
      if (err.message.includes("already registered") || err.message.includes("duplicate")) {
        setError("This email is already registered. Try signing in instead.");
      } else if (err.message.includes("rate limit")) {
        setError("Too many signups. Please wait a moment and try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={pageWrapper}>
        <div style={{ ...card, maxWidth: "420px", padding: "40px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
          <h2 style={title}>Account Created!</h2>
          <p style={{ color: colors.textSecondary, fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
            Your account is ready. Sign in with your email and password.
          </p>
          <button
            style={{ ...button, width: "100%" }}
            onClick={() => navigate("/login", { state: { role }, replace: true })}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapper}>
      <div style={{ ...card, maxWidth: "420px", padding: "40px" }}>
        <h2 style={title}>Create Account</h2>
        <p style={{ color: colors.textSecondary, marginBottom: "28px", fontSize: "14px" }}>
          Sign up as {role.charAt(0).toUpperCase() + role.slice(1)}
        </p>

        {error && (
          <p style={{
            color: colors.danger,
            fontSize: "13px",
            marginBottom: "12px",
            background: "#fee2e2",
            padding: "10px",
            borderRadius: "8px",
          }}>
            {error}
          </p>
        )}

        <input
          style={input}
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          style={input}
          placeholder="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={input}
          type="password"
          placeholder="Password (min. 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          style={{ ...button, width: "100%", marginTop: "8px", opacity: loading ? 0.7 : 1 }}
          onClick={handleSignup}
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p style={{ marginTop: "20px", fontSize: "14px", color: colors.textSecondary }}>
          Already have an account?{" "}
          <Link to="/login" state={{ role }} style={{ color: colors.primaryDark, fontWeight: "600" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
