import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SkeletonLine } from "./Skeleton";

export default function ProtectedRoute({ children, allowedRoles }) {
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
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
