import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { messageForOAuthError } from "../lib/authErrors";

const wrapperStyle = { width: "100%", marginBottom: "16px" };

const buttonStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  padding: "12px 16px",
  borderRadius: "10px",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  background: "rgba(255, 255, 255, 0.95)",
  color: "#1f2937",
  fontSize: "15px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s ease",
  fontFamily: "'Inter', sans-serif",
};

const disabledStyle = { opacity: 0.6, cursor: "not-allowed" };

const dividerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  margin: "0 0 16px",
  color: "rgba(255, 255, 255, 0.4)",
  fontSize: "12px",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const lineStyle = { flex: 1, height: "1px", background: "rgba(255, 255, 255, 0.12)" };

const errorStyle = {
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
};

/**
 * "Continue with Google" — the standard OAuth redirect flow.
 *
 * This button only STARTS the sign-in: Supabase redirects the browser to
 * Google and back to /auth/callback, where the session, the profile row and
 * the role-based redirect are all handled. Nothing here decides who is signed
 * in, and no secret is ever involved — only the public site origin goes to
 * supabase.auth.signInWithOAuth.
 *
 * A cancelled sign-in is reported on the callback, not here. This screen only
 * sees failures to START the flow: the provider disabled in the Dashboard, a
 * bad redirect URL, or no connectivity.
 */
export default function GoogleSignInButton() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      // On success the browser navigates away to Google; `busy` stays true
      // so the button cannot be double-clicked into a second redirect.
      await signInWithGoogle();
    } catch (err) {
      setError(messageForOAuthError(err));
      setBusy(false);
    }
  };

  return (
    <div style={wrapperStyle}>
      {error && (
        <div style={errorStyle}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label="Continue with Google"
        style={{ ...buttonStyle, ...(busy ? disabledStyle : null) }}
      >
        <GoogleGlyph />
        {busy ? "Redirecting to Google..." : "Continue with Google"}
      </button>

      {/* Separates the OAuth button from the email+password form below it. */}
      <div style={{ ...dividerStyle, marginTop: "16px", marginBottom: "0" }}>
        <span style={lineStyle} />
        <span>or</span>
        <span style={lineStyle} />
      </div>
    </div>
  );
}

/** The official four-colour Google "G" mark, inlined so no network call is made. */
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
