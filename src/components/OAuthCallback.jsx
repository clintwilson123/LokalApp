import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  parseAuthCallback,
  isOAuthCallback,
  clearCallbackHash,
} from "../lib/authCallback";
import { postAuthPath } from "../lib/authFlow";
import { AUTH_MSG } from "../lib/authErrors";
import { isCancelledOAuth, oauthIntentFromSearch } from "../lib/oauth";
import { writeGooglePrefill } from "../lib/pendingVerification";
import { pageWrapper, card, title, subtitle } from "../uiStyles";

// Captured at module scope, before auth-js can consume it: the implicit-grant
// handler stores the session and clears the hash a network round-trip later,
// but this module graph evaluates synchronously first — so the fragment is
// read exactly as Google redirected it.
const INITIAL_HASH = typeof window !== "undefined" ? window.location.hash : "";

// One decision per page load. INITIAL_HASH never changes, so a remount or a
// StrictMode double-invocation must not replay the callback: the guard lives
// at module scope, not on the component.
let callbackHandled = false;

/**
 * Owns the Google (OAuth) redirect.
 *
 * Supabase sends the browser back to /auth/callback with either:
 *
 *  * success — an access_token fragment carrying provider_token (auth-js has
 *    already taken the session from it). We wait for the profile row that
 *    ensureOAuthProfile() creates, then send the user wherever the existing
 *    role rules send everyone: admin only if the DATABASE profile says
 *    "admin", otherwise the applicant dashboard (or /verify-email if somehow
 *    unverified, /consent if consent is still outstanding).
 *  * error — the person cancelled on Google's consent screen, or the provider
 *    is misconfigured. Told which, on /login, without touching any session.
 *  * ?intent=signup — the Signup page started this round-trip. A brand-new
 *    Google user who still owes consent is handed back to /signup (session
 *    KEPT, same user UUID) with their Google address and name to prefill the
 *    completion form. Everyone else takes the normal destination rules.
 *
 * It never decides authentication itself: every redirect is derived from the
 * session + profile AuthContext has already loaded, using the same
 * postAuthPath() the password flow uses.
 */
export default function OAuthCallback() {
  const { loading, user, profile, refreshSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const retryRef = useRef(0);

  useEffect(() => {
    if (loading || callbackHandled) return;

    const parsed = parseAuthCallback(INITIAL_HASH || window.location.hash);

    // --- Error fragment: cancelled, denied, or provider misconfigured. -----
    if (parsed.kind === "error") {
      callbackHandled = true;
      clearCallbackHash();
      const notice = isCancelledOAuth(parsed)
        ? AUTH_MSG.oauthCancelled
        : AUTH_MSG.oauthFailed;
      navigate("/login", {
        replace: true,
        state: { notice, noticeType: "error" },
      });
      return;
    }

    // An ordinary visit to /auth/callback (bookmarked, refreshed after the
    // hash was cleared) — send the signed-in user onward, everyone else home.
    if (parsed.kind !== "success" || !isOAuthCallback(parsed)) {
      callbackHandled = true;
      navigate(user ? postAuthPath(profile, user) : "/", { replace: true });
      return;
    }

    // --- Success fragment: auth-js owns the session, we own the hand-off. --
    clearCallbackHash();

    // No session after the exchange settled — the token was rejected or the
    // redirect URL is misconfigured. Never a silent blank page.
    if (!user) {
      callbackHandled = true;
      navigate("/login", {
        replace: true,
        state: { notice: AUTH_MSG.oauthFailed, noticeType: "error" },
      });
      return;
    }

    // Profile row still missing: ensureOAuthProfile() may have hit a transient
    // read failure. Retry a couple of times, then fail loudly rather than
    // bounce the user to "/" with no explanation.
    if (!profile) {
      if (retryRef.current < 2) {
        retryRef.current += 1;
        refreshSession();
        return;
      }
      callbackHandled = true;
      navigate("/login", {
        replace: true,
        state: { notice: AUTH_MSG.oauthProfileFailed, noticeType: "error" },
      });
      return;
    }

    // A suspended account never reaches a dashboard — or the Signup
    // completion form. Park on /login with the reason; Login refuses to
    // auto-redirect suspended sessions, so this cannot loop.
    if (profile.status === "suspended") {
      callbackHandled = true;
      navigate("/login", {
        replace: true,
        state: { notice: AUTH_MSG.suspended, noticeType: "error" },
      });
      return;
    }

    // Same destination rules as every other sign-in path — with ONE
    // exception: a round-trip the Signup page started (?intent=signup) for a
    // brand-new Google user who still owes consent. The session is KEPT (this
    // is the same Supabase user, never a second account) and the person lands
    // on /signup with their Google address and name to review, edit and
    // accept the consent document. An existing, already-consented profile —
    // or an admin — takes the normal dashboard path untouched, so an old
    // profile's name is never pushed back through an edit form.
    const intent = oauthIntentFromSearch(location.search);
    if (
      intent === "signup" &&
      profile.role !== "admin" &&
      profile.consent_accepted !== true
    ) {
      callbackHandled = true;
      const meta = user.user_metadata || {};
      const prefill = {
        email: String(user.email || "").trim(),
        name: String(profile.full_name || meta.full_name || meta.name || "")
          .trim()
          .slice(0, 100),
      };
      writeGooglePrefill(prefill);
      navigate("/signup", { replace: true, state: { googlePrefill: prefill } });
      return;
    }

    callbackHandled = true;
    navigate(postAuthPath(profile, user), { replace: true });
  }, [loading, user, profile, navigate, location.pathname, location.search, refreshSession]);

  return (
    <div style={pageWrapper}>
      <div style={card}>
        <div style={{ fontSize: "42px", marginBottom: "8px" }}>🔐</div>
        <h2 style={title}>Completing sign-in</h2>
        <p style={{ ...subtitle, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <span style={{
            display: "inline-block", width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.2)",
            borderTopColor: "#93c5fd", borderRadius: "50%", animation: "spin 0.6s linear infinite",
          }} />
          Taking you to your dashboard...
        </p>
      </div>
    </div>
  );
}
