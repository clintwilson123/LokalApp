import React, { useState } from "react";

export default function DiscoverTalent() {
  const [selectedJob, setSelectedJob] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const jobFiles = [
    { id: 1, title: "Sales Assistant", count: 45, icon: "🛍️" },
    { id: 2, title: "Computer Service", count: 12, icon: "💻" },
    { id: 3, title: "Repair Technician", count: 8, icon: "🔧" },
    { id: 4, title: "Store Manager", count: 15, icon: "🏪" }
  ];

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 1500);
  };

  const getRecommendations = (jobTitle) => {
    const data = {
      "Sales Assistant": [
        { name: "Jake Williams", university: "City University", score: 92, skills: "Communication | Sales" },
        { name: "Anna Ramirez", university: "State College", score: 88, skills: "Customer Service | Sales" }
      ],
      "Store Manager": [
        { name: "Mark Evans", university: "North Ridge", score: 85, skills: "Leadership | Inventory" },
        { name: "Emma Johnson", university: "Central High", score: 79, skills: "Customer Service" }
      ]
    };
    return data[jobTitle] || [{ name: "General Applicant", university: "N/A", score: 70, skills: "Basic" }];
  };

  if (selectedJob) {
    return (
      <div style={{ textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          
          {/* UPDATED: Minimal Circular Arrow Back Button */}
          <button onClick={() => setSelectedJob(null)} style={minimalBackBtn} aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          
          <button 
            onClick={handleScan} 
            style={{ ...scanBtn, opacity: isScanning ? 0.7 : 1 }}
            disabled={isScanning}
          >
            {isScanning ? "🤖 Scanning..." : "🔍 AI Match Scan"}
          </button>
        </div>

        <h3 style={{ color: "#1a3b5c", marginBottom: "5px" }}>{selectedJob.title}</h3>
        <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "25px" }}>
          Manual AI audit active for applicant suitability analysis.
        </p>
        
        <div style={{ ...aiRecommendationGrid, filter: isScanning ? "blur(3px)" : "none", transition: "0.4s ease" }}>
          {getRecommendations(selectedJob.title).map((app, i) => (
            <div key={i} style={talentCard}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={avatar}>👤</div>
                <div>
                  <div style={{ fontWeight: "700", color: "#1a3b5c" }}>{app.name}</div>
                  <div style={{ fontSize: "11px", color: "#22c55e", fontWeight: "600" }}>✓ {app.skills}</div>
                </div>
              </div>

              <div style={scoreDonut}>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#22c55e" }}>{app.score}%</div>
                <div style={{ fontSize: "9px", color: "#64748b" }}>Suitable</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={centeredContainer}>
      <div style={grid2x2}>
        {jobFiles.map(job => (
          <div key={job.id} style={fileBox} onClick={() => setSelectedJob(job)}>
            <div style={{ fontSize: "36px", marginBottom: "15px" }}>{job.icon}</div>
            <div style={{ fontWeight: "800", color: "#1a3b5c", fontSize: "18px" }}>{job.title}</div>
            <div style={{ color: "#1a73e8", fontWeight: "600", marginTop: "5px" }}>{job.count} Applicants</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- New Styling for Minimalist Elements ---

const minimalBackBtn = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  backgroundColor: "#ffffff",
  border: "1px solid #e2eaf4",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
};

const scanBtn = {
  backgroundColor: "#1a73e8",
  color: "#fff",
  border: "none",
  padding: "10px 20px",
  borderRadius: "14px",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(26, 115, 232, 0.2)"
};

const centeredContainer = { display: "flex", justifyContent: "center", width: "100%" };
const grid2x2 = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "25px", width: "100%", maxWidth: "700px" };
const fileBox = { backgroundColor: "#fff", padding: "40px 20px", borderRadius: "28px", textAlign: "center", cursor: "pointer", border: "1px solid #e2eaf4" };
const aiRecommendationGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" };
const talentCard = { backgroundColor: "#fff", padding: "20px", borderRadius: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e2eaf4" };
const scoreDonut = { width: "65px", height: "65px", borderRadius: "50%", border: "4px solid #22c55e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" };
const avatar = { width: "45px", height: "45px", borderRadius: "50%", backgroundColor: "#f1f5f9", marginRight: "12px", display: "flex", alignItems: "center", justifyContent: "center" };