import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { isEmailVerified, roleOf, dashboardPathFor } from "./lib/authFlow";
import { readPendingEmail, clearPendingEmail } from "./lib/pendingVerification";

import Home from "./pages/home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";
import About from "./pages/About";
import VerifyEmail from "./pages/VerifyEmail";
import Consent from "./pages/Consent";
import AdminDashboard from "./pages/AdminDashboard";
import ApplicantDashboard from "./pages/ApplicantDashboard";


const publicPaths = ["/", "/login", "/signup", "/forgot-password", "/update-password", "/about", "/verify-email", "/consent"];

/**
 * The Supabase confirmation link redirects to the project Site URL (no custom
 * redirect URL is configured, and none is needed), so a user who clicks it
 * arrives at "/" holding a freshly confirmed session. This picks them up,
 * syncs the profile (AuthContext does that on sign-in) and sends them to the
 * dashboard for their role.
 *
 * It only ever acts on a browser that is actually waiting on a confirmation
 * link, so ordinary visits to "/" are untouched. It never sends anyone to
 * /login, so it cannot take part in a loop.
 */
function PostConfirmRedirect() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    // /verify-email owns its own confirmed-user handoff; don't race it for the
    // pending address it needs to display.
    if (location.pathname === "/verify-email") return;
    if (!user || !profile) return;
    if (!isEmailVerified(user, profile)) return;

    const pending = readPendingEmail();
    if (!pending) return;
    if ((user.email || "").toLowerCase() !== pending.toLowerCase()) return;

    clearPendingEmail();
    navigate(dashboardPathFor(roleOf(profile, user)), { replace: true });
  }, [user, profile, loading, navigate, location.pathname]);

  return null;
}

function AppContent() {
  const location = useLocation();
  const showNav = publicPaths.includes(location.pathname);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PostConfirmRedirect />
      {showNav && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/about" element={<About />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/consent" element={<Consent />} />

        {/* Applicant routes */}
        <Route path="/find-jobs" element={<ProtectedRoute allowedRoles={["applicant"]}><ApplicantDashboard /></ProtectedRoute>} />
        <Route path="/apply-job/:jobId" element={<ProtectedRoute allowedRoles={["applicant"]}><ApplicantDashboard /></ProtectedRoute>} />
        <Route path="/my-applications" element={<ProtectedRoute allowedRoles={["applicant"]}><ApplicantDashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={["applicant"]}><ApplicantDashboard /></ProtectedRoute>} />


        {/* Admin routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]} requireVerification={false}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/jobs" element={<ProtectedRoute allowedRoles={["admin"]} requireVerification={false}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/applicants" element={<ProtectedRoute allowedRoles={["admin"]} requireVerification={false}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["admin"]} requireVerification={false}><AdminDashboard /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
