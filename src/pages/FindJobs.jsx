import React from "react";
import { useNavigate } from "react-router-dom";

export default function FindJobs() {
  const navigate = useNavigate();

  const jobs = [
    { id: 1, title: "Sales Assistant", count: 45, icon: "🛍️" },
    { id: 2, title: "Computer Service", count: 12, icon: "💻" },
    { id: 3, title: "Repair Technician", count: 8, icon: "🔧" },
    { id: 4, title: "Store Manager", count: 15, icon: "🏪" }
  ];

  return (
    <div style={container}>
      {/* 2x2 Grid Layout */}
      <div style={jobGrid}>
        {jobs.map(job => (
          <div 
            key={job.id} 
            style={jobCard} 
            onClick={() => navigate(`/apply-job/${job.id}`)}
          >
            <div style={iconWrapper}>{job.icon}</div>
            <h3 style={jobTitleText}>{job.title}</h3>
            <p style={applicantCountText}>{job.count} Applicants</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- STYLES REPLICATING image_d59303.png ---

const container = {
  width: "100%",
  height: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "20px",
  boxSizing: "border-box"
};

const jobGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)", // Recreates the 2x2 look
  gap: "35px",
  width: "100%",
  maxWidth: "850px"
};

const jobCard = {
  backgroundColor: "#ffffff",
  padding: "50px 20px",
  borderRadius: "40px", // High rounding for the modern look
  textAlign: "center",
  cursor: "pointer",
  boxShadow: "0 10px 25px rgba(0,0,0,0.02)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  transition: "transform 0.2s ease"
};

const iconWrapper = {
  fontSize: "45px",
  marginBottom: "15px"
};

const jobTitleText = {
  color: "#1a3b5c", // Dark Navy
  fontSize: "20px",
  fontWeight: "800",
  margin: "0 0 8px 0"
};

const applicantCountText = {
  color: "#4a90e2", // Blue text for applicants
  fontSize: "15px",
  fontWeight: "700",
  margin: 0
};