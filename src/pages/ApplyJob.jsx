import React from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function ApplyJob() {
  const navigate = useNavigate();
  const { jobId } = useParams(); // This gets the "1", "2", etc. from the URL

  // 1. Define the data for all 4 jobs
  const allJobs = {
    "1": {
      title: "Sales Assistant",
      company: "CJTECH Computer Trading",
      location: "Sangi, Toledo City",
      salary: "₱15,000 — ₱18,000 / month",
      description: "Assist customers, handle transactions, and maintain store cleanliness.",
      score: 85,
      requirements: ["High school graduate", "Assist customers", "Good communication", "Handle transactions"]
    },
    "2": {
      title: "Computer Service",
      company: "CJTECH Computer Trading",
      location: "Sangi, Toledo City",
      salary: "₱20,000 — ₱25,000 / month",
      description: "Provide technical support, repair hardware, and install software updates.",
      score: 92,
      requirements: ["IT Background", "Hardware Repair", "Software Troubleshooting", "Patience"]
    },
    "3": {
      title: "Repair Technician",
      company: "CJTECH Computer Trading",
      location: "Sangi, Toledo City",
      salary: "₱18,000 — ₱22,000 / month",
      description: "Diagnose and fix various electronic appliances and gadgets.",
      score: 78,
      requirements: ["Technical Vocational Course", "Tool Proficiency", "Diagnostics", "Manual Dexterity"]
    },
    "4": {
      title: "Store Manager",
      company: "CJTECH Computer Trading",
      location: "Sangi, Toledo City",
      salary: "₱30,000 — ₱35,000 / month",
      description: "Oversee daily operations, manage staff, and ensure sales targets are met.",
      score: 65,
      requirements: ["Management Experience", "Leadership", "Inventory Control", "Reporting"]
    }
  };

  // 2. Select the specific job based on the ID in the URL
  const job = allJobs[jobId] || allJobs["1"]; // Fallback to Sales Assistant if ID not found

  return (
    <div style={scrollContainer}>
      <div style={headerActions}>
        <button onClick={() => navigate(-1)} style={backBtn}>←</button>
        <div style={buttonGroup}>
          <button style={applyBtn}>Apply Now</button>
          <button style={whiteBtn}>🔖 Save Job</button>
        </div>
      </div>

      <div style={titleSection}>
        <h2 style={jobTitle}>{job.title}</h2>
        <p style={subText}>📍 {job.company} • {job.location}</p>
        <p style={salaryText}>{job.salary}</p>
      </div>

      <div style={contentGrid}>
        <div style={leftCol}>
          <div style={infoCard}>
            <h4 style={cardTitle}>Job Description</h4>
            <p style={cardBody}>{job.description}</p>
          </div>
          <div style={infoCard}>
            <h4 style={cardTitle}>Requirements</h4>
            <div style={reqGrid}>
              {job.requirements.map((req, index) => (
                <div key={index} style={reqItem}>✅ {req}</div>
              ))}
            </div>
          </div>
        </div>

        <div style={rightCol}>
          <div style={aiCard}>
            <h4 style={cardTitle}>AI Suitability</h4>
            <div style={scoreHeader}>
              <span style={scoreLabel}>AI Match Score:</span>
              <span style={scorePercent}>{job.score}%</span>
            </div>
            <div style={progressBase}>
              <div style={{ ...progressFill, width: `${job.score}%`, backgroundColor: job.score > 80 ? "#22c55e" : "#facc15" }}></div>
            </div>
            <p style={{ fontSize: "12px", color: "#64748b", marginTop: "10px" }}>
              {job.score > 80 ? "Great match for your profile!" : "You might need more specific skills for this."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- KEEP ALL YOUR PREVIOUS STYLES BELOW ---
const scrollContainer = { height: "100%", overflowY: "auto", textAlign: "left" };
const headerActions = { display: "flex", justifyContent: "space-between", marginBottom: "20px" };
const backBtn = { width: "40px", height: "40px", borderRadius: "50%", border: "1px solid #e2eaf4", backgroundColor: "#fff", cursor: "pointer" };
const buttonGroup = { display: "flex", gap: "10px" };
const applyBtn = { backgroundColor: "#4a90e2", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: "700", cursor: "pointer" };
const whiteBtn = { backgroundColor: "#fff", border: "1px solid #e2eaf4", padding: "10px 15px", borderRadius: "10px", cursor: "pointer", color: "#64748b" };
const titleSection = { marginBottom: "25px" };
const jobTitle = { fontSize: "28px", color: "#1a3b5c", fontWeight: "800", margin: 0 };
const subText = { color: "#64748b", margin: "5px 0" };
const salaryText = { fontWeight: "700", color: "#1a3b5c" };
const contentGrid = { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px" };
const leftCol = { display: "flex", flexDirection: "column", gap: "20px" };
const rightCol = { display: "flex", flexDirection: "column" };
const infoCard = { backgroundColor: "#fff", padding: "20px", borderRadius: "20px", border: "1px solid #eef2f6" };
const cardTitle = { color: "#1a3b5c", fontSize: "16px", fontWeight: "700", marginBottom: "10px" };
const cardBody = { color: "#64748b", fontSize: "14px", lineHeight: "1.6" };
const reqGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" };
const reqItem = { fontSize: "13px", color: "#1a3b5c" };
const aiCard = { backgroundColor: "rgba(255, 255, 255, 0.5)", padding: "20px", borderRadius: "20px", border: "1px solid #e2eaf4" };
const scoreHeader = { display: "flex", justifyContent: "space-between", marginBottom: "8px" };
const scoreLabel = { fontWeight: "700", color: "#1a3b5c", fontSize: "14px" };
const scorePercent = { fontWeight: "800", color: "#22c55e" };
const progressBase = { height: "8px", background: "#e2eaf4", borderRadius: "10px" };
const progressFill = { height: "100%", borderRadius: "10px" };