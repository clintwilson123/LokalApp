import React from "react";

export default function Notifications() {
  const alerts = [
    { 
      id: 1, 
      msg: "Account Verification: Action Required! Please verify your profile to access all listings.", 
      date: "30 minutes ago" 
    },
    { 
      id: 2, 
      msg: "Your application for Computer Service was viewed.", 
      date: "2 hours ago" 
    },
    { 
      id: 3, 
      msg: "New job match: Store Manager in CJTECH Computer Trading.", 
      date: "1 day ago" 
    }
  ];

  return (
    <div style={container}>
      <h2 style={mainTitle}>NOTIFICATIONS</h2>
      
      <div style={notifList}>
        {alerts.map((n) => (
          <div key={n.id} style={notifPill}>
            <div style={textContent}>
              <p style={notifMsg}>{n.msg}</p>
              <span style={notifDate}>{n.date}</span>
            </div>
            
            <button style={deleteBtn} aria-label="Delete notification">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- SIMPLIFIED PILL STYLES ---

const container = {
  padding: "20px",
  textAlign: "center"
};

const mainTitle = {
  fontSize: "24px",
  fontWeight: "800",
  color: "#1a3b5c",
  marginBottom: "30px",
  letterSpacing: "1px"
};

const notifList = {
  display: "flex",
  flexDirection: "column",
  gap: "15px",
  maxWidth: "850px",
  margin: "0 auto"
};

const notifPill = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#ffffff",
  padding: "12px 30px",
  borderRadius: "50px", // Full pill shape
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.03)",
  borderLeft: "6px solid #4a8ca6", // Accent border
  textAlign: "left"
};

const textContent = {
  flex: 1,
  paddingRight: "15px"
};

const notifMsg = {
  margin: 0,
  fontSize: "15px",
  fontWeight: "500",
  color: "#1a3b5c"
};

const notifDate = {
  fontSize: "12px",
  color: "#94a3b8",
  marginTop: "4px",
  display: "block"
};

const deleteBtn = {
  backgroundColor: "#f1f5f9",
  border: "none",
  width: "35px",
  height: "35px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#64748b"
};