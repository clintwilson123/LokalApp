import { Routes, Route, Navigate } from "react-router-dom";
import Footer from "./components/Footer";

// Page Imports
import Home from "./pages/home";
import SelectRole from "./pages/SelectRole";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import About from "./pages/About";
import AdminDashboard from "./pages/AdminDashboard";
import ApplicantDashboard from "./pages/ApplicantDashboard";

export default function App() {
  return (
    <>
      <Routes>
        {/* Public Landing Pages */}
        <Route path="/" element={<Home />} />
        <Route path="/roles" element={<SelectRole />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/about" element={<About />} />

        {/* Applicant Dashboard Routes */}
        <Route path="/applicant-dashboard" element={<ApplicantDashboard />} />
        <Route path="/find-jobs" element={<ApplicantDashboard />} />
        <Route path="/notifications" element={<ApplicantDashboard />} />
        <Route path="/interview-schedule" element={<ApplicantDashboard />} />
        <Route path="/profile" element={<ApplicantDashboard />} />
        
        {/* Admin Dashboard Routes - all mapped to AdminDashboard component */}
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/discover-talent" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminDashboard />} />
        <Route path="/admin/reports" element={<AdminDashboard />} />
        <Route path="/admin/settings" element={<AdminDashboard />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      
      <Footer />
    </>
  );
}