import { useState } from "react";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { pageWrapper, card, title, input, button } from "../uiStyles";
import { colors, radii, shadows } from "../uiStyles";

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp } = useAuth();

  const role = location.state?.role || "applicant";
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
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
      await signUp(email, password, fullName, role, phoneNumber);
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

  return (
    <div style={pageWrapper}>
      <div style={{ ...card, maxWidth: "420px", padding: "40px", position: "relative", overflow: "hidden", backgroundColor: "#fff", backdropFilter: "blur(20px)", borderRadius: radii.xxl, border: "1px solid rgba(255,255,255,0.5)", boxShadow: shadows.xl }}>
        {/* Morph overlay — fades in on success */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          backgroundColor: colors.white,
          opacity: success ? 1 : 0,
          pointerEvents: success ? "auto" : "none",
          transition: "opacity 0.5s ease",
          zIndex: 10, padding: "40px",
        }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ marginBottom: "16px" }}>
            <circle cx="28" cy="28" r="26" fill="none" stroke={colors.primaryDark} strokeWidth="3"
              style={{
                strokeDasharray: 163, strokeDashoffset: success ? 0 : 163,
                transition: "stroke-dashoffset 0.6s ease 0.2s",
              }} />
            <polyline points="18,28 25,35 38,21" fill="none" stroke={colors.primaryDark} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              style={{
                strokeDasharray: 30, strokeDashoffset: success ? 0 : 30,
                transition: "stroke-dashoffset 0.4s ease 0.7s",
              }} />
          </svg>
          <h2 style={{
            margin: 0, color: colors.navy, fontSize: "20px", fontWeight: "700",
            transform: success ? "translateY(0)" : "translateY(12px)",
            opacity: success ? 1 : 0,
            transition: "all 0.4s ease 0.6s",
          }}>
            Account Created!
          </h2>
          <p style={{
            color: colors.textSecondary, fontSize: "13px", margin: "8px 0 20px",
            transform: success ? "translateY(0)" : "translateY(12px)",
            opacity: success ? 1 : 0,
            transition: "all 0.4s ease 0.75s",
          }}>
            Your account is ready. Head to login.
          </p>
          <button
            style={{
              ...button, width: "100%",
              transform: success ? "translateY(0) scale(1)" : "translateY(12px) scale(0.96)",
              opacity: success ? 1 : 0,
              transition: "all 0.4s ease 0.9s",
            }}
            onClick={() => navigate("/login", { state: { role }, replace: true })}
          >
            Go to Sign In
          </button>
        </div>

        {/* Login form — fades out when success */}
        <div style={{ opacity: success ? 0 : 1, transition: "opacity 0.35s ease" }}>
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
            placeholder="Phone number (optional)"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
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
    </div>
  );
}
