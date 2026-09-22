import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
  if (profile?.status === "suspended") {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  // Email verification check (skip for admin)
  if (requireVerification && profile && profile.role !== "admin" && !profile.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }

  // Consent check (skip for admin)
  if (profile && profile.role !== "admin" && !profile.consent_accepted) {
    return <Navigate to="/consent" replace />;
  }

  return children;
}
