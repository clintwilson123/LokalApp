import React from "react";
import { title } from "../uiStyles";

export default function Notifications() {
  const alerts = [
    { id: 1, msg: "Your application for Computer Service was viewed.", date: "2 hours ago" },
    { id: 2, msg: "New job match: Store Manager in Toledo City.", date: "1 day ago" }
  ];

  return (
    <div style={{ padding: "10px" }}>
      <h2 style={{ ...title, textAlign: "center", marginBottom: "30px", fontSize: "24px" }}>
        NOTIFICATIONS
      </h2>
      
      <div style={notifContainer}>
        {alerts.map((n) => (
          <div key={n.id} style={notifCard}>
            <div style={notifContent}>
              <p style={notifMsg}>{n.msg}</p>
              <small style={notifDate}>{n.date}</small>
            </div>
            
            {/* Circular Trash Icon */}
            <button style={deleteBtn} aria-label="Delete notification">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- STYLES REPLICATED FROM IMAGE ---

const notifContainer = {
  maxWidth: "800px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "15px"
};

const notifCard = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "rgba(255, 255, 255, 0.6)", // Frosted glass effect
  padding: "15px 25px",
  borderRadius: "50px", // Pill shape
  borderLeft: "8px solid #4a8ca6", // Thick left accent
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.03)",
  position: "relative",
  backdropFilter: "blur(5px)"
};

const notifContent = {
  textAlign: "left",
  paddingLeft: "10px"
};

const notifMsg = {
  margin: 0,
  fontSize: "15px",
  fontWeight: "500",
  color: "#1a3b5c"
};

const notifDate = {
  color: "#94a3b8",
  fontSize: "12px",
  marginTop: "4px",
  display: "block"
};

const deleteBtn = {
  width: "45px",
  height: "45px",
  borderRadius: "50%",
  backgroundColor: "#e2eaf4", // Light circular background
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "0.2s ease"
};