import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { postAuthPath } from "../lib/authFlow";
import { getPasswordStrength } from "../lib/sanitize";
import { pageWrapper, card, title, subtitle, input, inputWrapper, inputIcon, button } from "../uiStyles";

const bgBlob = {
  position: "absolute", borderRadius: "50%", filter: "blur(80px)",
  opacity: 0.15, pointerEvents: "none", zIndex: 1,
};

/**
 * /set-password — the guaranteed way for a GOOGLE account to get a CJLink
 * password.
 *
 * Why this exists: a person can sign up with Google, walk past the completion
 * form, and end up with an account that has no password at all. Email +
 * password on /login then fails with "Wrong email or password" and there is
 * nowhere to fix it — the account looks broken. It is not: Google simply never
 * shares its password, so CJLink has nothing to check against. The answer is
 * not to store the Google password (impossible and unsafe) but to give every
 * Google account a reliable place to choose its own CJLink password.
 *
 * Reached from the OAuth callback whenever a Google user who already accepted
 * the consent has no recorded password — so "Continue with Google" on /login
 * lands here instead of a dashboard, exactly like the completion form does for
 * a brand-new signup. The completion form writes the same flag, so anyone who
 * finishes it is never asked again.
 *
 * The flag lives in auth.user_metadata (set alongside the password in ONE
 * updateUser call) — no new database column, and nothing that can drift from
 * the password itself. It is deliberately not a security control: the real
 * source of truth is Supabase Auth. It only remembers "this account chose a
 * password once", so we stop asking.
 *
 * Nothing here re-asks for consent. The person already accepted the CJLink
 * Consent Agreement; re-presenting the same checkbox would undo the whole
 * point of having one agreement in one place.
 */
export default function SetPassword() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, loadProfile } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const submittingRef = useRef(false);

  const strength = getPasswordStrength(password);

  // Route out anyone this page cannot help, before they can start typing:
  // no session at all, or an email+password account that already has one.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (user.app_metadata?.provider === "email") {
      navigate(postAuthPath(profile, user), { replace: true });
    }
  }, [authLoading, user, profile, navigate]);

  const finish = () => {
    navigate(postAuthPath(profile, user), { replace: true });
  };

  const handleSet = async () => {
    if (submittingRef.current) return;
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      // Password and the "this account has chosen one" flag go in the SAME
      // write, so the flag can never claim a password that was not stored.
      // Existing metadata is spread first — GoTrue may replace rather than
      // merge, and losing `role` would cost us a fallback elsewhere.
      const meta = user.user_metadata || {};
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { ...meta, cjlink_password_set: true },
      });
      if (updateError) throw updateError;

      setDone(true);
      try {
        await loadProfile?.(user.id);
      } catch {
        // The password is stored either way; the dashboard re-reads the
        // profile on its own next auth event.
      }
      setTimeout(finish, 1400);
    } catch (err) {
      // Nothing was recorded: this is the same all-or-nothing rule the
      // completion form follows. The person retries, and "Skip" is always
      // there if the write keeps failing, so no one is ever trapped here.
      setError(
        err?.message ||
          "Could not save your password. Please try again, or skip and keep using Google."
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleSet();
  };

  // Auth has not settled yet: showing the form here would flash it for a beat
  // before the redirect below fires, and a signed-out visitor would get a form
  // that can only ever fail.
  if (authLoading) {
    return (
      <div style={pageWrapper}>
        <div style={card}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Checking your session...</p>
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
          <h2 style={title}>Password saved</h2>
          <p style={subtitle}>You can now sign in with your email and this password.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapper}>
      <div style={{ ...bgBlob, width: "350px", height: "350px", background: "#4a90e2", top: "-5%" }} />
      <div style={{ ...bgBlob, width: "250px", height: "250px", background: "#a78bfa", bottom: "-5%", left: "-5%" }} />

      <div style={card}>
        <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔑</div>
        <h2 style={title}>Set your CJLink password</h2>
        <p style={subtitle}>So you can sign in with just your email — no Google needed</p>

        <div style={{
          padding: "12px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px",
          backgroundColor: "rgba(74,144,226,0.15)", border: "1px solid rgba(74,144,226,0.3)",
          color: "#93c5fd", textAlign: "left", lineHeight: 1.6,
        }}>
          Signed in as <strong>{user?.email}</strong> via Google.
          Your Google password stays with Google and is never shared with CJLink —
          that is why typing it on the login page does not work. Choose a new,
          separate password for CJLink below.
        </div>

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5", fontSize: "13px", padding: "12px 16px", borderRadius: "10px",
            marginBottom: "16px", textAlign: "left",
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div style={inputWrapper}>
          <span style={inputIcon}>🔒</span>
          <input
            style={input}
            type="password"
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>

        {password && (
          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{
                  flex: 1, height: "4px", borderRadius: "2px",
                  backgroundColor: i <= strength.score ? strength.color : "rgba(255,255,255,0.1)",
                }} />
              ))}
            </div>
            <span style={{ fontSize: "11px", color: strength.color, fontWeight: "600" }}>
              {strength.label}
            </span>
          </div>
        )}

        <div style={inputWrapper}>
          <span style={inputIcon}>✓</span>
          <input
            style={input}
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          style={{ ...button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          onClick={handleSet}
          disabled={loading}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              Saving...
            </span>
          ) : (
            "Save password"
          )}
        </button>

        {/* An escape hatch, not a setting: a Google sign-in still works, so
            declining here never locks anyone out — and because nothing is
            recorded, the offer comes back next sign-in rather than silently
            leaving the account without a password forever. */}
        <button
          type="button"
          onClick={finish}
          disabled={loading}
          style={{
            width: "100%", marginTop: "10px", padding: "10px", borderRadius: "10px",
            background: "none", border: "none", cursor: loading ? "not-allowed" : "pointer",
            color: "rgba(255,255,255,0.5)", fontSize: "13px", fontWeight: "600",
          }}
        >
          Skip for now — I&apos;ll keep signing in with Google
        </button>
      </div>
    </div>
  );
}
