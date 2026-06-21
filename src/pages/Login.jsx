import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { pageWrapper, card, title, input, button } from "../uiStyles";
import { colors } from "../uiStyles";

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

  // Redirect when profile loads via context
  useEffect(() => {
    if (justSignedIn && !loading && profile) {
      navigate(
        profile.role === "admin" ? "/admin-dashboard" : "/find-jobs",
        { replace: true }
      );
    }
  }, [profile, loading, justSignedIn, navigate]);

  // Already logged in
  useEffect(() => {
    if (!justSignedIn && !loading && user && profile) {
      navigate(
        profile.role === "admin" ? "/admin-dashboard" : "/find-jobs",
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
      setJustSignedIn(true);
      setSubmitting(false);

      // Fallback: use RPC to bypass RLS and get role directly
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 600));
        const { data: dbRole } = await supabase.rpc("get_my_role");
        if (dbRole) {
          navigate(
            dbRole === "admin" ? "/admin-dashboard" : "/find-jobs",
            { replace: true }
          );
          return;
        }
      }

      // Last resort: metadata
      const fallback = result.user.user_metadata?.role || "applicant";
      navigate(fallback === "admin" ? "/admin-dashboard" : "/find-jobs", { replace: true });
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
      <div style={{ ...card, maxWidth: "420px", padding: "40px" }}>
        {justSignedIn ? (
          <>
            <h2 style={title}>Redirecting...</h2>
            <p style={{ color: colors.textSecondary, marginTop: "12px", fontSize: "14px" }}>
              Please wait while we set up your session.
            </p>
          </>
        ) : (
          <>
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

            <p style={{ marginTop: "20px", fontSize: "14px", color: colors.textSecondary }}>
              Don't have an account?{" "}
              <Link to="/signup" state={{ role }} style={{ color: colors.primaryDark, fontWeight: "600" }}>
                Sign up
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
