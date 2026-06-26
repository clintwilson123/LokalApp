import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/home";
import SelectRole from "./pages/SelectRole";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";
import About from "./pages/About";
import AdminDashboard from "./pages/AdminDashboard";
import ApplicantDashboard from "./pages/ApplicantDashboard";

const publicPaths = ["/", "/roles", "/login", "/signup", "/forgot-password", "/update-password", "/about"];

function AppContent() {
  const location = useLocation();
  const showNav = publicPaths.includes(location.pathname);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {showNav && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/roles" element={<SelectRole />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/about" element={<About />} />

        {/* Applicant routes */}
        <Route path="/find-jobs" element={<ProtectedRoute allowedRoles={["applicant"]}><ApplicantDashboard /></ProtectedRoute>} />
        <Route path="/apply-job/:jobId" element={<ProtectedRoute allowedRoles={["applicant"]}><ApplicantDashboard /></ProtectedRoute>} />
        <Route path="/my-applications" element={<ProtectedRoute allowedRoles={["applicant"]}><ApplicantDashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={["applicant"]}><ApplicantDashboard /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/jobs" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/applicants" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />

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
