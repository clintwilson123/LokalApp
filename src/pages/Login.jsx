import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { pageWrapper, card, title, input, button } from "../uiStyles";
import { colors, radii, shadows } from "../uiStyles";

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn, user, profile, loading } = useAuth();

  const role = location.state?.role || "applicant";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSignedIn, setJustSignedIn] = useState(false);
  const [userName, setUserName] = useState("");

  // Redirect when profile loads via context
  useEffect(() => {
    if (justSignedIn && !loading && profile) {
      navigate(
        profile.role === "admin" ? "/admin" : "/find-jobs",
        { replace: true }
      );
    }
  }, [profile, loading, justSignedIn, navigate]);

  // Already logged in
  useEffect(() => {
    if (!justSignedIn && !loading && user && profile) {
      navigate(
        profile.role === "admin" ? "/admin" : "/find-jobs",
        { replace: true }
      );
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
      setUserName(result?.user?.user_metadata?.full_name || result?.user?.email?.split("@")[0] || "there");

      setJustSignedIn(true);
      setSubmitting(false);

      const { data: dbRole } = await supabase.rpc("get_my_role");

      // Morph delay: let the animation play before redirecting
      setTimeout(() => {
        if (dbRole) {
          navigate(
            dbRole === "admin" ? "/admin" : "/find-jobs",
            { replace: true }
          );
        }
      }, 1400);
    } catch (err) {
      if (err.message?.includes("Invalid login credentials")) {
        setError("Wrong email or password.");
      } else if (err.message?.includes("Email not confirmed")) {
        setError("Please confirm your email first. Check your inbox.");
      } else {
        setError(err.message || "Login failed.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div style={pageWrapper}>
      <div style={{ ...card, maxWidth: "420px", padding: "40px", position: "relative", overflow: "hidden", backgroundColor: "#fff", backdropFilter: "blur(20px)", borderRadius: radii.xxl, border: "1px solid rgba(255,255,255,0.5)", boxShadow: shadows.xl }}>
        {/* Morph overlay: fades in over the form */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          backgroundColor: colors.white,
          opacity: justSignedIn ? 1 : 0,
          pointerEvents: justSignedIn ? "auto" : "none",
          transition: "opacity 0.5s ease",
          zIndex: 10, padding: "40px",
        }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ marginBottom: "16px" }}>
            <circle cx="28" cy="28" r="26" fill="none" stroke={colors.primaryDark} strokeWidth="3"
              style={{
                strokeDasharray: 163, strokeDashoffset: justSignedIn ? 0 : 163,
                transition: "stroke-dashoffset 0.6s ease 0.2s",
              }} />
            <polyline points="18,28 25,35 38,21" fill="none" stroke={colors.primaryDark} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              style={{
                strokeDasharray: 30, strokeDashoffset: justSignedIn ? 0 : 30,
                transition: "stroke-dashoffset 0.4s ease 0.7s",
              }} />
          </svg>
          <h2 style={{
            margin: 0, color: colors.navy, fontSize: "20px", fontWeight: "700",
            transform: justSignedIn ? "translateY(0)" : "translateY(12px)",
            opacity: justSignedIn ? 1 : 0,
            transition: "all 0.4s ease 0.6s",
          }}>
            Welcome back, {userName}!
          </h2>
          <p style={{
            color: colors.textSecondary, fontSize: "13px", margin: "8px 0 0",
            transform: justSignedIn ? "translateY(0)" : "translateY(12px)",
            opacity: justSignedIn ? 1 : 0,
            transition: "all 0.4s ease 0.75s",
          }}>
            Taking you to your dashboard...
          </p>
        </div>

        {/* Login form — fades out when justSignedIn */}
        <div style={{
          opacity: justSignedIn ? 0 : 1,
          transition: "opacity 0.35s ease",
        }}>
          <h2 style={title}>Welcome Back</h2>
          <p style={{ color: colors.textSecondary, marginBottom: "28px", fontSize: "14px" }}>
            Login as {role.charAt(0).toUpperCase() + role.slice(1)}
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
            placeholder="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            style={{ ...button, width: "100%", marginTop: "8px", opacity: submitting ? 0.7 : 1 }}
            onClick={handleLogin}
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>

          <p style={{ marginTop: "12px", fontSize: "13px", textAlign: "center" }}>
            <Link to="/forgot-password" style={{ color: colors.textSecondary }}>
              Forgot password?
            </Link>
          </p>

          <p style={{ marginTop: "20px", fontSize: "14px", color: colors.textSecondary }}>
            Don't have an account?{" "}
            <Link to="/signup" state={{ role }} style={{ color: colors.primaryDark, fontWeight: "600" }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
