import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon, button, link, linkHighlight, radii } from "../uiStyles";

const bgBlob = {
  position: "absolute",
  borderRadius: "50%",
  filter: "blur(80px)",
  opacity: 0.15,
  pointerEvents: "none",
  zIndex: 1,
};

export default function Login() {
  const navigate = useNavigate();
  const { signIn, user, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSignedIn, setJustSignedIn] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (!justSignedIn && !loading && user && profile) {
      // Redirect unverified users to verify email
      if (profile.role !== "admin" && !profile.email_verified) {
        navigate("/verify-email", { replace: true });
        return;
      }
      navigate(profile.role === "admin" ? "/admin" : "/find-jobs", { replace: true });
    }
  }, [user, profile, loading, justSignedIn, navigate]);

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await signIn(email, password);
      setUserName(
        result?.user?.user_metadata?.full_name ||
        result?.user?.email?.split("@")[0] ||
        "there"
      );
      const signedInRole = result?.role || "applicant";
      setJustSignedIn(true);
      setSubmitting(false);
      setTimeout(() => {
        navigate(signedInRole === "admin" ? "/admin" : "/find-jobs", { replace: true });
      }, 1400);
    } catch (err) {
      if (err.message?.includes("Invalid login credentials")) {
        setError("Wrong email or password.");
      } else if (err.message?.includes("verify your email") || err.message?.includes("Email not confirmed")) {
        setError(err.message || "Please verify your email first. Check your inbox for the verification code.");
        // Redirect to verify email page after showing error
        setTimeout(() => navigate("/verify-email", { replace: true }), 2000);
      } else {
        setError(err.message || "Login failed.");
      }
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div style={pageWrapper}>
      <div style={{ ...bgBlob, width: "400px", height: "400px", background: "#4a90e2", top: "-10%", left: "-5%" }} />
      <div style={{ ...bgBlob, width: "300px", height: "300px", background: "#a78bfa", bottom: "-5%", right: "-5%" }} />
      <div style={{ ...bgBlob, width: "200px", height: "200px", background: "#22c55e", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />

      <div style={card}>
        <div style={{
          opacity: justSignedIn ? 0 : 1,
          transition: "opacity 0.35s ease",
        }}>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
          <h2 style={title}>Welcome Back</h2>
          <p style={subtitle}>Sign in to your CJLink account</p>

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
          <div style={inputWrapper}>
            <span style={inputIcon}>🔑</span>
            <input
              style={input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
            <Link to="/forgot-password" style={link}>
              Forgot password?
            </Link>
          </div>

          <button
            style={{ ...button, opacity: submitting ? 0.7 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
            onClick={handleLogin}
            disabled={submitting}
          >
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>

          <p style={{ marginTop: "24px", fontSize: "14px", color: "rgba(255, 255, 255, 0.5)" }}>
            Don't have an account?{" "}
            <Link to="/signup" style={linkHighlight}>
              Sign up
            </Link>
          </p>
        </div>

        {/* Success overlay */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: radii.xxl,
          opacity: justSignedIn ? 1 : 0,
          pointerEvents: justSignedIn ? "auto" : "none",
          transition: "opacity 0.5s ease",
          zIndex: 10, padding: "40px",
        }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="30" fill="none" stroke="#4a90e2" strokeWidth="3"
              style={{
                strokeDasharray: 188.5, strokeDashoffset: justSignedIn ? 0 : 188.5,
                transition: "stroke-dashoffset 0.6s ease 0.2s",
              }} />
            <polyline points="20,32 28,40 44,24" fill="none" stroke="#4a90e2" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              style={{
                strokeDasharray: 34, strokeDashoffset: justSignedIn ? 0 : 34,
                transition: "stroke-dashoffset 0.4s ease 0.7s",
              }} />
          </svg>
          <h2 style={{
            margin: "16px 0 0", color: "#fff", fontSize: "22px", fontWeight: "700",
            transform: justSignedIn ? "translateY(0)" : "translateY(12px)",
            opacity: justSignedIn ? 1 : 0,
            transition: "all 0.4s ease 0.6s",
          }}>
            Welcome back, {userName}!
          </h2>
          <p style={{
            color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "8px 0 0",
            transform: justSignedIn ? "translateY(0)" : "translateY(12px)",
            opacity: justSignedIn ? 1 : 0,
            transition: "all 0.4s ease 0.75s",
          }}>
            Taking you to your dashboard...
          </p>
        </div>
      </div>
    </div>
  );
}
