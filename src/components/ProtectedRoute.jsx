import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isEmailVerified } from "../lib/authFlow";
import { SkeletonLine } from "./Skeleton";

export default function ProtectedRoute({ children, allowedRoles, requireVerification = true }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", gap: "12px", padding: "20px" }}>
        <div style={{ width: "200px" }}><SkeletonLine width="100%" height="16px" /></div>
        <div style={{ width: "160px" }}><SkeletonLine width="100%" height="12px" /></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Verification is decided from the trusted Auth session/user state
  // (user.email_confirmed_at) plus profiles.email_verified — a mirror that
  // profiles_security_guard makes impossible to set client-side without a
  // real confirmation in auth.users. Nothing consulted here is client-supplied.
  const verified = isEmailVerified(user, profile);

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
    return <Navigate to="/login" replace />;
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

  // Consent check (skip for admin)
  if (profile.role !== "admin" && !profile.consent_accepted) {
    return <Navigate to="/consent" replace />;
  }

  return children;
}
