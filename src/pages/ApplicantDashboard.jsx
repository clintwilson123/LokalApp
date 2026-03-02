import React from "react";
import { useLocation, NavLink, useNavigate } from "react-router-dom";
import { card, title } from "../uiStyles";
import FindJobs from "./FindJobs";
import Notifications from "./Notifications";
import InterviewSchedule from "./InterviewSchedule";
import Profile from "./Profile";

export default function ApplicantDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear any local storage or session data here
    navigate("/"); // Redirects to home page
  };

  const renderContent = () => {
    switch (location.pathname) {
      case "/find-jobs":
      case "/applicant-dashboard": return <FindJobs />;
      case "/notifications": return <Notifications />;
      case "/interview-schedule": return <InterviewSchedule />;
      case "/profile": return <Profile />;
      default: return <FindJobs />;
    }
  };

  return (
    <div style={dashboardWrapper}>
      {/* SIDEBAR - Dark Blue Background */}
      <aside style={sidebarStyle}>
        <div style={{ padding: "40px 20px" }}>
          <h2 style={sidebarLogo}>Lokal</h2>
          <nav>
            <NavLink to="/find-jobs" style={({ isActive }) => ({ ...navItem, ...activeStyle(isActive) })}>
              <span style={icon}>💼</span> Jobs
            </NavLink>
            <NavLink to="/notifications" style={({ isActive }) => ({ ...navItem, ...activeStyle(isActive) })}>
              <span style={icon}>🔔</span> Notifications
            </NavLink>
            <NavLink to="/interview-schedule" style={({ isActive }) => ({ ...navItem, ...activeStyle(isActive) })}>
              <span style={icon}>📅</span> Schedule
            </NavLink>
            <NavLink to="/profile" style={({ isActive }) => ({ ...navItem, ...activeStyle(isActive) })}>
              <span style={icon}>👤</span> Profile
            </NavLink>

            {/* LOGOUT - Placed directly under Profile */}
            <button onClick={handleLogout} style={logoutBtnStyle}>
              <span style={icon}>🚪</span> Logout
            </button>
          </nav>
        </div>
      </aside>

      <main style={mainContent}>
        <div style={focalBlueCard}>
          <h2 style={topBrandHeader}>Find Your Next Job</h2>
          <div style={contentCardInner}>
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- STYLES REPLICATED FROM DASHBOARD UI ---

const dashboardWrapper = { display: "flex", minHeight: "100vh", backgroundColor: "#f4f7fa" };

const sidebarStyle = { 
  width: "240px", 
  background: "#1a3b5c", // Dark Navy from reference
  height: "100vh", 
  position: "sticky", 
  top: 0 
};

const sidebarLogo = { color: "#ffffff", fontWeight: "800", fontSize: "24px", marginBottom: "40px", paddingLeft: "15px" };

const navItem = { 
  display: "flex", 
  alignItems: "center", 
  padding: "14px 15px", 
  textDecoration: "none", 
  color: "rgba(255,255,255,0.7)", 
  borderRadius: "12px", 
  marginBottom: "8px", 
  fontWeight: "500",
  transition: "0.2s"
};

const logoutBtnStyle = {
  ...navItem, // Inherits the same spacing/radius as nav items
  width: "100%",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "#f87171", // Distinct red for logout
  marginTop: "10px",
  textAlign: "left"
};

const icon = { marginRight: "12px", fontSize: "18px" };

const activeStyle = (isActive) => isActive ? { 
  backgroundColor: "rgba(255,255,255,0.2)", // Glass pill effect
  color: "#ffffff", 
  fontWeight: "700" 
} : {};

const mainContent = { flex: 1, padding: "40px", display: "flex", justifyContent: "center", alignItems: "center" };
const focalBlueCard = { backgroundColor: "#d6e6f7", borderRadius: "32px", width: "100%", maxWidth: "950px", padding: "40px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" };
const topBrandHeader = { textAlign: "center", color: "#1a3b5c", fontSize: "22px", fontWeight: "800", marginBottom: "30px" }; 
const contentCardInner = { backgroundColor: "rgba(255, 255, 255, 0.4)", borderRadius: "24px", padding: "30px", minHeight: "450px", backdropFilter: "blur(10px)" };