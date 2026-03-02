import React, { useState } from "react";

export default function FindJobs() {
  const [selectedJob, setSelectedJob] = useState(null);

  // Data matching the specific job titles and icons you provided
  const jobs = [
    { id: 1, title: "Sales Assistant", count: 45, icon: "🛍️" },
    { id: 2, title: "Computer Service", count: 12, icon: "💻" },
    { id: 3, title: "Repair Technician", count: 8, icon: "🔧" },
    { id: 4, title: "Store Manager", count: 15, icon: "🏪" }
  ];

  if (selectedJob) {
    return (
      <div style={{ textAlign: "left" }}>
        <button onClick={() => setSelectedJob(null)} style={minimalBackBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h3 style={{ color: "#1a3b5c", marginTop: "20px" }}>{selectedJob.title} Details</h3>
        <p style={{ color: "#64748b" }}>Job requirements and AI suitability scan would appear here.</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      {/* 2x2 White Grid Layout */}
      <div style={jobGrid}>
        {jobs.map(job => (
          <div key={job.id} style={whiteJobCard} onClick={() => setSelectedJob(job)}>
            <div style={centeredIcon}>{job.icon}</div>
            <div style={jobTitleText}>{job.title}</div>
            <div style={applicantCountText}>{job.count} Applicants</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- STYLES FOR THE WHITE CARD UI ---

const jobGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)", // Forced 2x2 grid
  gap: "20px",
  maxWidth: "800px",
  margin: "0 auto"
};

const whiteJobCard = {
  backgroundColor: "#ffffff", // Pure white background
  padding: "40px 20px",
  borderRadius: "28px", // Very rounded corners
  textAlign: "center",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  transition: "transform 0.2s ease",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center"
};

const centeredIcon = {
  fontSize: "40px",
  marginBottom: "15px",
  display: "block"
};

const jobTitleText = {
  fontWeight: "700",
  color: "#1a3b5c", // Dark blue/navy text
  fontSize: "18px",
  marginBottom: "5px"
};

const applicantCountText = {
  color: "#1a73e8", // Bright blue text for applicants
  fontWeight: "700",
  fontSize: "14px"
};

const minimalBackBtn = {
  width: "35px",
  height: "35px",
  borderRadius: "50%",
  backgroundColor: "#fff",
  border: "1px solid #e2eaf4",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
};