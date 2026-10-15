import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isEmailVerified } from "../lib/authFlow";
import { AUTH_MSG } from "../lib/authErrors";
import { SkeletonLine } from "./Skeleton";

export default function ProtectedRoute({ children, allowedRoles, requireVerification = true }) {
  const { user, profile, loading } = useAuth();

  /**
   * Auth events are not evidence that the visitor has gone anywhere.
   *
   * Opening a second tab makes Supabase announce itself over its
   * BroadcastChannel, and every access-token refresh announces itself too —
   * AuthContext answers both by putting `loading` back to true while it
   * re-reads the profile. Treating each of those blips as "not ready" swapped
   * the page for this skeleton, and React does not keep a subtree alive
   * across a change of element type: the page unmounted and was rebuilt from
   * empty state. The visitor saw the site refresh itself and lost every
   * half-typed form on it.
   *
   * So the skeleton is only owed where there is nothing on screen to protect —
   * the very first resolve, or a DIFFERENT person than the one already
   * rendered. A re-read of the same person leaves the page mounted, and every
   * guard below still runs against the values this render resolved to, so
   * sign-out, suspension, consent and wrong-role redirects are untouched.
   */
  const [settledFor, setSettledFor] = useState(null);
  useEffect(() => {
    if (!loading && user && profile) setSettledFor(user.id);
  }, [loading, user, profile]);

  if (loading && settledFor !== user?.id) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", gap: "12px", padding: "20px" }}>
        <div style={{ width: "200px" }}><SkeletonLine width="100%" height="16px" /></div>
        <div style={{ width: "160px" }}><SkeletonLine width="100%" height="12px" /></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Verification is decided from the trusted Auth session/user state only
  // (user.email_confirmed_at, what GoTrue writes at confirmation time).
  // profiles.email_verified is a display mirror and never authorizes access
  // on its own. Nothing consulted here is client-supplied.
  const verified = isEmailVerified(user);

  // Never fail open: an authenticated user with no readable profile gets no
  // access to protected pages. "/" is public, so this cannot loop.
  if (!profile) {
    // An unconfirmed signup legitimately has no profile row yet (RLS creates
    // it only after the confirmation link issues a session) — send them to
    // the verification screen rather than a blank home.
    if (!verified) return <Navigate to="/verify-email" replace />;
    return <Navigate to="/" replace />;
  }

  if (profile.status === "suspended") {
    // Park on /login WITH the reason (Login renders state.notice). The
    // notice is wording only — it never authenticates or authorizes anyone,
    // and Login refuses to auto-redirect a suspended session, so this cannot
    // loop back into this component.
    return (
      <Navigate
        to="/login"
        replace
        state={{ notice: AUTH_MSG.suspended, noticeType: "error" }}
      />
    );
  }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  // Email verification check (skip for admin).
  // NOTE: /verify-email is a public route and is never wrapped by this
  // component, so an unverified applicant can always reach it.
  if (requireVerification && profile.role !== "admin" && !verified) {
    return <Navigate to="/verify-email" replace />;
  }

  // Consent check (skip for admin). The standalone /consent page no longer
  // exists: the agreement has exactly one home — the checkbox on sign-up, with
  // the full document readable in place from the dialog beside it — so there
  // is no second page to send anyone to.
  //
  // A profile still showing consent as unaccepted was usually signed up long
  // enough ago that the marker carrying their tick expired before the email
  // was confirmed, so the row recorded "never consented" for someone who
  // plainly did tick the box. They are parked on /login WITH the reason, just
  // like a suspended account: the session is kept, and Login replaces its form
  // with a consent panel that collects the agreement here — same checkbox,
  // same document — rather than sending them back to a sign-up form that would
  // reject an account that already exists.
  if (profile.role !== "admin" && !profile.consent_accepted) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ notice: AUTH_MSG.consentRequired, noticeType: "error" }}
      />
    );
  }

  return children;
}
