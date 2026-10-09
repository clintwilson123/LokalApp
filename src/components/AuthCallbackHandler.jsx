import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import {
  parseAuthCallback,
  isConfirmationCallback,
  callbackErrorMessage,
  clearCallbackHash,
  waitForCallbackSession,
} from "../lib/authCallback";
import { AUTH_MSG } from "../lib/authErrors";
import {
  readPendingEmail,
  clearPendingEmail,
  readPendingSignup,
  writeVerifiedNotice,
} from "../lib/pendingVerification";

// Captured at module scope, before anything can observe it: Supabase Auth's
// implicit-grant handler clears window.location.hash itself once it has
// stored a success fragment (a network round-trip later) and leaves an error
// fragment untouched — but the whole module graph evaluates synchronously
// before auth-js's first await resumes, so this reads the fragment exactly as
// the confirmation link delivered it.
const INITIAL_HASH = typeof window !== "undefined" ? window.location.hash : "";

// One decision per page load. INITIAL_HASH never changes, so a remount, a
// second effect pass or React's StrictMode double-invocation must not replay
// the callback: the guard lives at module scope, not on the component.
let callbackHandled = false;

/**
 * Owns the Supabase confirmation-link redirect.
 *
 * The link redirects to the project Site URL (no custom redirect is
 * configured), so the callback arrives here as a URL fragment and one of two
 * things happened:
 *
 *  * success — auth-js takes the session from the fragment (after its own
 *    network check). We record that the address was confirmed, retire the
 *    pending markers, hand the browser back to a signed-out state — but only
 *    for a session THIS fragment provably created (see below) — and send the
 *    user to /login to sign in with their password. Verification never
 *    auto-logs anyone in.
 *  * error — the link was expired, reused or malformed, and auth-js drops
 *    that fragment on the floor. The user is told, on /verify-email when this
 *    browser is still waiting on that address so a fresh link can be
 *    requested, otherwise on /login.
 *
 * It acts exactly once, only on fragment evidence — ordinary visits to "/"
 * and password-recovery callbacks (which own /update-password) are untouched.
 */
export default function AuthCallbackHandler() {
  const { loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || callbackHandled) return;

    const parsed = parseAuthCallback(INITIAL_HASH || window.location.hash);
    if (parsed.kind === "none") return;

    // Confirmation redirects land on the Site URL root. An error that arrives
    // anywhere else (a recovery link failing while pointing at
    // /update-password) belongs to that page, not here.
    if (parsed.kind === "error" && location.pathname !== "/") return;
    if (parsed.kind === "success" && !isConfirmationCallback(parsed)) return;

    callbackHandled = true;
    clearCallbackHash();

    if (parsed.kind === "error") {
      const notice = callbackErrorMessage(parsed);
      const pending = readPendingEmail();
      navigate(pending ? "/verify-email" : "/login", {
        replace: true,
        state: pending
          ? { email: pending, notice, noticeType: "error" }
          : { notice, noticeType: "error" },
      });
      return;
    }

    const pendingEmail = readPendingEmail();
    const pendingSignup = readPendingSignup();
    // Notice address only: token, then whatever this browser was waiting on.
    // Never used to decide who is signed in.
    const noticeEmail = (parsed.email || pendingEmail || pendingSignup?.email || "").trim();

    // Written before anything that can fail, so /login and /verify-email can
    // explain what happened even if the sign-out below does not go through.
    // It is a message only — never proof of authentication.
    if (noticeEmail) writeVerifiedNotice(noticeEmail);
    clearPendingEmail();
    // pendingSignup is deliberately kept: AuthContext.ensureProfile consumes
    // it, and only once the profile row really exists.

    // Hand this browser back to a signed-out state so the confirmation link
    // can never leave anyone signed in — decided purely by identity:
    // storage user id == the fragment token's `sub`, AND the stored token is
    // the fragment's own token. That proves the session was created by THIS
    // callback. Email never decides; an unrelated session, a leftover
    // session of another account, or no session at all is left strictly
    // alone. auth-js stores the session a network round-trip later, so the
    // check waits for it in the background instead of racing it, and gives
    // up after CONFIRMATION_SETTLE_MS rather than guess. scope "local":
    // this browser only — other devices of the user stay signed in. A
    // refusal or a failed exchange just leaves the session, and /login
    // shows the success notice without auto-redirecting until the user
    // signs in themselves.
    const proof = {
      sub: parsed.sub,
      email: parsed.email,
      accessToken: parsed.accessToken,
    };
    waitForCallbackSession(supabase.auth, proof)
      .then((matched) => {
        if (!matched) return null;
        return supabase.auth.signOut({ scope: "local" }).catch(() => null);
      })
      .catch(() => {
        // The notice and the redirect still stand either way.
      });

    navigate("/login", {
      replace: true,
      state: {
        notice: AUTH_MSG.verifiedSuccess,
        noticeType: "success",
        ...(noticeEmail ? { email: noticeEmail } : {}),
      },
    });
  }, [loading, navigate, location.pathname]);

  return null;
}
