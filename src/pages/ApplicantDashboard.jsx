import React from "react";
import { useLocation, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { colors } from "../uiStyles";
import ApplyJob from "./ApplyJob";
import FindJobs from "./FindJobs";
import MyApplications from "./MyApplications";
import Profile from "./Profile";

const navItems = [
  { path: "/find-jobs", icon: "💼", label: "Browse Jobs", desc: "Openings" },
  { path: "/my-applications", icon: "📋", label: "My Applications", desc: "Track status" },
  { path: "/profile", icon: "👤", label: "My Profile", desc: "Edit details" },
];

export default function ApplicantDashboard() {
  const location = useLocation();
  const { signOut, profile, user } = useAuth();
  const handleLogout = () => signOut();

  const renderContent = () => {
    const path = location.pathname;
    if (path.startsWith("/apply-job/")) return <ApplyJob />;
    switch (path) {
      case "/find-jobs":
      case "/applicant-dashboard":
        return <FindJobs />;
      case "/my-applications":
        return <MyApplications />;
      case "/profile":
        return <Profile />;
      default:
        return <FindJobs />;
    }
  };

  const isApplyJob = location.pathname.startsWith("/apply-job/");
  const currentItem = navItems.find((i) => i.path === location.pathname);

  return (
    <div style={dashboardLayout}>
      <aside style={sidebar}>
        <div style={sidebarInner}>
          <div style={logoText}>Lokal</div>

          <nav style={navSection}>
            <div style={navLabel}>NAVIGATION</div>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={{
                    ...navItem,
                    background: active
                      ? "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))"
                      : "transparent",
                    color: active ? "#fff" : "rgba(255,255,255,0.6)",
                    borderLeft: active ? "3px solid #60a5fa" : "3px solid transparent",
                  }}
                >
                  <span style={navIcon}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: active ? "700" : "500" }}>{item.label}</div>
                    <div style={{ fontSize: "11px", opacity: 0.6 }}>{item.desc}</div>
                  </div>
                </NavLink>
              );
            })}
          </nav>

          <div style={sidebarFooter}>
            <div style={profileStrip}>
              <div style={avatarSmall}>{profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || "?"}</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#fff" }}>{profile?.full_name || "Applicant"}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{user?.email}</div>
              </div>
            </div>
            <button onClick={handleLogout} style={logoutBtn}>
              <span>🚪</span> Logout
            </button>
          </div>
        </div>
      </aside>

      <main style={mainArea}>
        <div style={topBar}>
          <div>
            <h1 style={pageTitle}>{currentItem?.label || "Find Jobs"}</h1>
            <p style={pageBreadcrumb}>{isApplyJob ? "Apply" : currentItem?.desc || "Browse available positions"}</p>
          </div>
          <div style={headerRight}>
            <span style={dateBadge}>{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            <span style={welcomeBadge}>👋 Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</span>
          </div>
        </div>
        <div style={contentCard}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

const dashboardLayout = { display: "flex", minHeight: "100vh", background: "linear-gradient(135deg, #f0f4f8 0%, #e8edf4 100%)" };
const sidebar = { width: "270px", background: `linear-gradient(180deg, ${colors.navy} 0%, #0f2840 100%)`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" };
const sidebarInner = { padding: "28px 18px", display: "flex", flexDirection: "column", height: "100%" };
const logoText = { fontSize: "24px", fontWeight: "800", color: "#fff", marginBottom: "36px", paddingLeft: "6px" };
const navSection = { flex: 1 };
const navLabel = { fontSize: "10px", fontWeight: "700", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginBottom: "12px", paddingLeft: "6px" };
const navItem = { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "12px", marginBottom: "4px", fontSize: "14px", textDecoration: "none", transition: "all 0.2s", cursor: "pointer" };
const navIcon = { fontSize: "20px", width: "32px", textAlign: "center" };
const sidebarFooter = { borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px" };
const profileStrip = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", padding: "0 6px" };
const avatarSmall = { width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #60a5fa, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", color: "#fff" };
const logoutBtn = { width: "100%", padding: "10px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", color: colors.danger, cursor: "pointer", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center", transition: "all 0.2s" };
const mainArea = { flex: 1, padding: "32px 40px", overflow: "auto" };
const topBar = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" };
const pageTitle = { fontSize: "26px", fontWeight: "800", color: colors.navy, margin: 0 };
const pageBreadcrumb = { fontSize: "12px", color: colors.textSecondary, marginTop: "2px" };
const headerRight = { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" };
const dateBadge = { fontSize: "12px", color: colors.textSecondary, background: "#fff", padding: "6px 14px", borderRadius: "20px", fontWeight: "500", border: "1px solid #e2eaf4" };
const welcomeBadge = { fontSize: "12px", color: colors.primaryDark, background: "#d6e6f7", padding: "6px 14px", borderRadius: "20px", fontWeight: "600" };
const contentCard = { background: "rgba(255,255,255,0.75)", backdropFilter: "blur(20px)", borderRadius: "24px", padding: "32px", minHeight: "600px", border: "1px solid rgba(255,255,255,0.5)", boxShadow: "0 8px 32px rgba(0,0,0,0.04)" };
