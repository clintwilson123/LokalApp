import React from "react";
import { NavLink, useLocation, useNavigate, Navigate } from "react-router-dom";
import { card, title } from "../uiStyles";

// Sub-component Imports
import DiscoverTalent from "./DiscoverTalent";
import Users from "./Users";
import Reports from "./Reports";
import Settings from "./Settings";

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { name: "Discover Talent", path: "/discover-talent", icon: "🔍" },
    { name: "Users", path: "/admin/users", icon: "👥" },
    { name: "Reports", path: "/admin/reports", icon: "📈" },
    { name: "Settings", path: "/admin/settings", icon: "⚙️" }
  ];

  const handleLogout = () => {
    navigate("/"); 
  };

  // Switch logic to render the correct component based on the URL path
  const renderContent = () => {
    switch (location.pathname) {
      case "/discover-talent": return <DiscoverTalent />;
      case "/admin/users": return <Users />;
      case "/admin/reports": return <Reports />;
      case "/admin/settings": return <Settings />;
      default: return <DiscoverTalent />;
    }
  };

  if (location.pathname === "/admin-dashboard") {
    return <Navigate to="/discover-talent" replace />;
  }

  const currentItem = menuItems.find(item => item.path === location.pathname);
  const displayTitle = currentItem ? currentItem.name : "Discover Talent";

  return (
    <div style={dashboardLayout}>
      {/* SIDEBAR - Dark Blue Background */}
      <aside style={sidebarContainer}>
        <div style={{ padding: "40px 24px" }}>
          <div style={logoBrand}>Lokal Admin</div>
          <nav>
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  ...navLinkStyle,
                  backgroundColor: isActive ? "rgba(255, 255, 255, 0.2)" : "transparent",
                  color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.7)",
                  fontWeight: isActive ? "700" : "500",
                })}
              >
                <span style={{ marginRight: "12px" }}>{item.icon}</span> {item.name}
              </NavLink>
            ))}

            {/* LOGOUT BUTTON - Door icon matches Applicant */}
            <button 
              onClick={handleLogout} 
              style={logoutBtnStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = "rgba(248, 113, 113, 0.1)"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
            >
              <span style={{ marginRight: "12px", fontSize: "18px" }}>🚪</span> Logout
            </button>
          </nav>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={mainContentCenter}>
        <div style={focalBlueCard}>
          <h2 style={headerStyle}>{displayTitle.toUpperCase()}</h2>
          <div style={contentInnerWrapper}>
            {/* Dynamically rendered content */}
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- STYLES ---

const dashboardLayout = { display: "flex", minHeight: "100vh", backgroundColor: "#f4f7fa" };
const sidebarContainer = { width: "260px", background: "#1a3b5c", height: "100vh", position: "sticky", top: 0 };
const logoBrand = { fontSize: "22px", fontWeight: "800", color: "#ffffff", marginBottom: "40px", paddingLeft: "18px" };

const navLinkStyle = { 
  textDecoration: "none", display: "flex", alignItems: "center", 
  padding: "14px 18px", borderRadius: "16px", marginBottom: "8px", 
  fontSize: "15px", transition: "0.3s ease" 
};

const logoutBtnStyle = {
  ...navLinkStyle,
  width: "100%",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "#f87171", // Soft red for Logout text
  marginTop: "15px",
  textAlign: "left",
};

const mainContentCenter = { flex: 1, padding: "40px", display: "flex", justifyContent: "center", alignItems: "center" };
const focalBlueCard = { ...card, backgroundColor: "#d6e6f7", borderRadius: "32px", width: "100%", maxWidth: "1000px", padding: "40px" };
const headerStyle = { color: "#1a3b5c", marginBottom: "25px", textAlign: "center", fontSize: "24px", fontWeight: "800" };
const contentInnerWrapper = { 
  backgroundColor: "rgba(255, 255, 255, 0.4)", 
  padding: "30px", 
  borderRadius: "24px", 
  minHeight: "500px", 
  backdropFilter: "blur(12px)" // Frosted glass effect
};