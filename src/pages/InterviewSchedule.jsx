import React from "react";
import { title } from "../uiStyles";

export default function InterviewSchedule() {
  return (
    <div style={{ padding: "10px" }}>
      <h2 style={{ ...title, textAlign: "center", marginBottom: "30px" }}>
        INTERVIEW SCHEDULE
      </h2>

      {/* Main Interview Card */}
      <div style={blueScheduleCard}>
        <div style={cardHeader}>
          <span style={whiteBullet}></span>
          <h4 style={interviewTitle}>Repair Technician Interview</h4>
        </div>

        <div style={detailRow}>
          <span style={detailIcon}>📅</span>
          <p style={detailText}>February 20, 2026 | 10:00 AM</p>
        </div>

        <div style={detailRow}>
          <span style={detailIcon}>📍</span>
          <p style={detailText}>Location: Gadget Hub Office</p>
        </div>
      </div>
    </div>
  );
}

// --- STYLES REPLICATED FROM IMAGE ---

const blueScheduleCard = {
  background: "linear-gradient(135deg, #4a8ca6 0%, #3a7187 100%)", // Rich blue gradient
  borderRadius: "24px", // Matches the modern rounded look
  padding: "30px",
  color: "white",
  maxWidth: "600px",
  margin: "0 auto",
  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)", // Depth shadow
  textAlign: "left"
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "15px"
};

const whiteBullet = {
  width: "8px",
  height: "8px",
  backgroundColor: "white",
  borderRadius: "50%",
  display: "inline-block"
};

const interviewTitle = {
  margin: 0,
  fontSize: "1.2rem",
  fontWeight: "600",
  letterSpacing: "0.5px"
};

const detailRow = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginTop: "8px",
  opacity: 0.9
};

const detailIcon = {
  fontSize: "16px"
};

const detailText = {
  margin: 0,
  fontSize: "0.95rem",
  fontWeight: "400"
};