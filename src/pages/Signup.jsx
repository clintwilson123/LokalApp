import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon, button, linkHighlight, radii } from "../uiStyles";

const bgBlob = {
  position: "absolute",
  borderRadius: "50%",
  filter: "blur(80px)",
  opacity: 0.15,
  pointerEvents: "none",
  zIndex: 1,
};

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
      await signUp(email, password, fullName, "applicant", phoneNumber);
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

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSignup();
  };

  return (
    <div style={pageWrapper}>
      <div style={{ ...bgBlob, width: "350px", height: "350px", background: "#4a90e2", top: "-5%", right: "-5%" }} />
      <div style={{ ...bgBlob, width: "250px", height: "250px", background: "#a78bfa", bottom: "-5%", left: "-5%" }} />
      <div style={{ ...bgBlob, width: "180px", height: "180px", background: "#22c55e", top: "40%", left: "60%", transform: "translate(-50%, -50%)" }} />

      <div style={card}>
        <div style={{ opacity: success ? 0 : 1, transition: "opacity 0.35s ease" }}>
          <div style={{ fontSize: "42px", marginBottom: "8px" }}>🚀</div>
          <h2 style={title}>Create Account</h2>
          <p style={subtitle}>Join Lokal and start your journey</p>

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
            <span style={inputIcon}>👤</span>
            <input
              style={input}
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div style={inputWrapper}>
            <span style={inputIcon}>📱</span>
            <input
              style={input}
              placeholder="Phone number (optional)"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
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
              placeholder="Password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <button
            style={{ ...button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            onClick={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>

          <p style={{ marginTop: "24px", fontSize: "14px", color: "rgba(255, 255, 255, 0.5)" }}>
            Already have an account?{" "}
            <Link to="/login" style={linkHighlight}>
              Sign in
            </Link>
          </p>
        </div>

        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: radii.xxl,
          opacity: success ? 1 : 0,
          pointerEvents: success ? "auto" : "none",
          transition: "opacity 0.5s ease",
          zIndex: 10, padding: "40px",
        }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="30" fill="none" stroke="#4a90e2" strokeWidth="3"
              style={{
                strokeDasharray: 188.5, strokeDashoffset: success ? 0 : 188.5,
                transition: "stroke-dashoffset 0.6s ease 0.2s",
              }} />
            <polyline points="20,32 28,40 44,24" fill="none" stroke="#4a90e2" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              style={{
                strokeDasharray: 34, strokeDashoffset: success ? 0 : 34,
                transition: "stroke-dashoffset 0.4s ease 0.7s",
              }} />
          </svg>
          <h2 style={{
            margin: "16px 0 0", color: "#fff", fontSize: "22px", fontWeight: "700",
            transform: success ? "translateY(0)" : "translateY(12px)",
            opacity: success ? 1 : 0,
            transition: "all 0.4s ease 0.6s",
          }}>
            Account Created!
          </h2>
          <p style={{
            color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "8px 0 24px",
            transform: success ? "translateY(0)" : "translateY(12px)",
            opacity: success ? 1 : 0,
            transition: "all 0.4s ease 0.75s",
          }}>
            Your account is ready to go.
          </p>
          <button
            style={{
              ...button,
              transform: success ? "translateY(0) scale(1)" : "translateY(12px) scale(0.96)",
              opacity: success ? 1 : 0,
              transition: "all 0.4s ease 0.9s",
            }}
            onClick={() => navigate("/login", { replace: true })}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
