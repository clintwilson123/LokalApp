import React from "react";

export default function InterviewSchedule() {
  return (
    <div style={container}>
      <h2 style={headerTitle}>INTERVIEW SCHEDULE</h2>

      {/* Main Combined Card */}
      <div style={fullCard}>
        
        {/* Blue Top Section */}
        <div style={blueTopSection}>
          <div style={cardHeader}>
             <span style={headerIcon}>🗓️</span>
             <h4 style={interviewTitle}>Repair Technician Interview</h4>
          </div>

          <div style={detailRow}>
            <span style={detailIcon}>📅</span>
            <p style={detailText}>February 20, 2026 | 10:00 AM</p>
          </div>

          <div style={detailRow}>
            <span style={detailIcon}>📍</span>
            <p style={detailText}>Location: CJTECH Computer Trading</p>
          </div>
        </div>

        {/* White Bottom Section */}
        <div style={whiteBottomSection}>
          <div style={instructionRow}>
            <span style={timerIcon}>🕒</span>
            <p style={instructionText}>
              Please arrive 10 minutes early and bring a copy of your resume.
            </p>
          </div>

          <button style={rescheduleBtn}>
            <span style={syncIcon}>🔄</span> Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

// --- STYLES REPLICATED FROM image_d58bc0.png & image_d58bc4.png ---

const container = {
  padding: "20px",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center"
};

const headerTitle = {
  color: "#1a3b5c",
  fontSize: "24px",
  fontWeight: "800",
  marginBottom: "40px",
  letterSpacing: "1px"
};

const fullCard = {
  width: "100%",
  maxWidth: "650px",
  borderRadius: "32px",
  overflow: "hidden", // Ensures sections stay within rounded corners
  boxShadow: "0 15px 35px rgba(0,0,0,0.1)",
};

const blueTopSection = {
  background: "linear-gradient(180deg, #5b92ad 0%, #4a7c96 100%)", // Matches blue in image_d58bc4.png
  padding: "35px 40px",
  color: "white",
  textAlign: "left"
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  gap: "15px",
  marginBottom: "20px"
};

const headerIcon = { fontSize: "24px" };

const interviewTitle = {
  margin: 0,
  fontSize: "22px",
  fontWeight: "700",
  letterSpacing: "0.5px"
};

const detailRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "10px"
};

const detailIcon = { fontSize: "18px" };

const detailText = {
  margin: 0,
  fontSize: "16px",
  fontWeight: "500",
  opacity: 0.95
};

const whiteBottomSection = {
  backgroundColor: "rgba(255, 255, 255, 0.8)", // Glassy white
  padding: "30px 40px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "20px"
};

const instructionRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  paddingBottom: "15px",
  borderBottom: "1px solid rgba(0,0,0,0.05)" // Subtle separator
};

const timerIcon = { fontSize: "20px", color: "#64748b" };

const instructionText = {
  margin: 0,
  color: "#475569",
  fontSize: "15px",
  fontWeight: "500",
  textAlign: "left"
};

const rescheduleBtn = {
  backgroundColor: "#5b92ad", // Matches the card blue
  color: "white",
  border: "none",
  padding: "12px 30px",
  borderRadius: "15px",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  boxShadow: "0 4px 12px rgba(91, 146, 173, 0.3)"
};

const syncIcon = { fontSize: "16px" };