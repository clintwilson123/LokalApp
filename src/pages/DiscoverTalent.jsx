import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { colors, radii, shadows } from "../uiStyles";
import { SkeletonGrid } from "../components/Skeleton";

export default function DiscoverTalent() {
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    const { data } = await supabase.from("jobs").select("*");
    if (data) setJobs(data);
  };

  const fetchApplicants = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, skills, location, phone_number, resume_url, bio, created_at")
      .eq("role", "applicant")
      .not("skills", "is", null);
    if (data) setApplicants(data);
  };

  useEffect(() => {
    Promise.all([fetchJobs(), fetchApplicants()]).finally(() => setLoading(false));
  }, []);

  const calculateMatch = (applicant, requirements) => {
    if (!applicant.skills || !requirements?.length) return 0;
    const appSkills = applicant.skills.toLowerCase().split(/[,|]/).map(s => s.trim()).filter(Boolean);
    const reqs = requirements.map(r => r.toLowerCase());

    let matchedSkills = [];
    for (const skill of appSkills) {
      if (reqs.some(req => req.includes(skill) || skill.includes(req))) {
        matchedSkills.push(skill);
      }
    }

    const baseScore = Math.round((matchedSkills.length / reqs.length) * 100);
    const breadthBonus = Math.min(10, appSkills.length * 2);
    return Math.min(100, baseScore + breadthBonus);
  };

  const handleScan = () => {
    if (!selectedJob) return;
    setIsScanning(true);

    setTimeout(() => {
      const reqs = selectedJob.requirements || [];
      const scored = applicants
        .map(a => ({
          ...a,
          score: calculateMatch(a, reqs),
          matchedSkills: a.skills
            ? a.skills.split(/[,|]/).map(s => s.trim()).filter(s =>
                reqs.some(r => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase()))
              )
            : [],
        }))
        .sort((a, b) => b.score - a.score);

      setCandidates(scored);
      setIsScanning(false);
    }, 1200);
  };

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setCandidates([]);
    setSelectedApplicant(null);
  };

  if (loading) {
    return <SkeletonGrid cards={4} />;
  }

  if (selectedApplicant) {
    const a = selectedApplicant;
    return (
      <div style={{ textAlign: "left" }}>
        <button onClick={() => setSelectedApplicant(null)} style={backBtn}>← Back</button>
        <div style={profileCard}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
            <div style={largeAvatar}>{a.full_name?.[0] || "?"}</div>
            <div>
              <h3 style={{ color: colors.navy, fontSize: "20px", fontWeight: "800", margin: 0 }}>{a.full_name}</h3>
              <p style={{ color: colors.textSecondary, fontSize: "13px", margin: "4px 0 0" }}>📍 {a.location || "N/A"}</p>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "center" }}>
              <div style={{ fontSize: "24px", fontWeight: "800", color: a.score >= 80 ? colors.success : colors.warning }}>{a.score}%</div>
              <div style={{ fontSize: "11px", color: colors.textSecondary }}>Match</div>
            </div>
          </div>
          <div style={infoRow}>
            <span style={infoLabel}>Skills</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {(a.skills?.split(/[,|]/) || []).map((s, i) => (
                <span key={i} style={skillBadge}>{s.trim()}</span>
              ))}
            </div>
          </div>
          {a.bio && (
            <div style={infoRow}>
              <span style={infoLabel}>About</span>
              <p style={{ fontSize: "14px", color: colors.navy, lineHeight: "1.6", margin: 0 }}>{a.bio}</p>
            </div>
          )}
          {a.matchedSkills?.length > 0 && (
            <div style={infoRow}>
              <span style={infoLabel}>Matched</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {a.matchedSkills.map((s, i) => (
                  <span key={i} style={{ ...skillBadge, backgroundColor: "#d4edda", color: "#155724" }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {a.phone_number && (
            <div style={infoRow}>
              <span style={infoLabel}>Phone</span>
              <span style={{ fontSize: "14px", color: colors.navy }}>{a.phone_number}</span>
            </div>
          )}
          {a.resume_url && (
            <div style={infoRow}>
              <span style={infoLabel}>Resume</span>
              <a href={a.resume_url} target="_blank" rel="noreferrer" style={resumeLink}>View Resume ↗</a>
            </div>
          )}
          <div style={infoRow}>
            <span style={infoLabel}>Applied</span>
            <span style={{ fontSize: "14px", color: colors.textSecondary }}>
              {a.created_at ? new Date(a.created_at).toLocaleDateString() : "N/A"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (selectedJob) {
    return (
      <div style={{ textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <button onClick={() => { setSelectedJob(null); setCandidates([]); }} style={backBtn}>←</button>
          <button onClick={handleScan} style={{ ...scanBtn, opacity: isScanning ? 0.7 : 1 }} disabled={isScanning}>
            {isScanning ? "🤖 Scanning..." : "🔍 AI Match Scan"}
          </button>
        </div>

        <h3 style={{ color: colors.navy, marginBottom: "4px" }}>{selectedJob.title}</h3>
        <p style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>{selectedJob.company} • {selectedJob.location} • {selectedJob.salary}</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
          {selectedJob.requirements?.map((r, i) => (
            <span key={i} style={reqBadge}>{r}</span>
          ))}
        </div>

        {candidates.length > 0 && (
          <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "16px" }}>
            Showing {candidates.length} matched applicants • sorted by relevance
          </p>
        )}

        {candidates.length === 0 && !isScanning && (
          <div style={{ textAlign: "center", padding: "40px 0", color: colors.textSecondary }}>
            <p style={{ fontSize: "14px", marginBottom: "8px" }}>No applicants scanned yet</p>
            <p style={{ fontSize: "12px" }}>Click "AI Match Scan" to analyze {applicants.length} applicants against this job</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", filter: isScanning ? "blur(3px)" : "none", transition: "0.4s ease" }}>
          {candidates.map((app, i) => (
            <div key={app.id || i} style={talentCard} onClick={() => setSelectedApplicant(app)}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                <div style={avatar}>{app.full_name?.[0] || "?"}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: "700", color: colors.navy, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {app.full_name || "Unknown"}
                  </div>
                  <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                    📍 {app.location || "N/A"}
                  </div>
                  {app.matchedSkills?.length > 0 && (
                    <div style={{ fontSize: "10px", color: colors.success, marginTop: "2px" }}>
                      ✓ {app.matchedSkills.slice(0, 2).join(", ")}{app.matchedSkills.length > 2 ? "..." : ""}
                    </div>
                  )}
                </div>
              </div>
              <div style={scoreCircle}>
                <div style={{ fontSize: "15px", fontWeight: "800", color: app.score >= 80 ? colors.success : app.score >= 60 ? colors.warning : colors.danger }}>
                  {app.score}%
                </div>
                <div style={{ fontSize: "9px", color: colors.textSecondary }}>Match</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "20px", textAlign: "center" }}>
        Select a job position to find matching applicants
      </p>
      <div style={grid2x2}>
        {jobs.map((job) => (
          <div key={job.id} style={fileBox} onClick={() => handleSelectJob(job)}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>{job.icon || "💼"}</div>
            <div style={{ fontWeight: "800", color: colors.navy, fontSize: "17px" }}>{job.title}</div>
            <div style={{ color: colors.textSecondary, fontSize: "12px", marginTop: "4px" }}>{job.company}</div>
            <div style={{ color: colors.primary, fontWeight: "600", marginTop: "6px", fontSize: "13px" }}>
              {applicants.length} Applicant{applicants.length !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const backBtn = {
  background: "none", border: "none", color: colors.primaryDark, cursor: "pointer",
  fontSize: "14px", fontWeight: "600", padding: "8px 0", marginBottom: "12px",
};
const scanBtn = {
  backgroundColor: colors.primaryDark, color: "#fff", border: "none",
  padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "700",
  cursor: "pointer",
};
const grid2x2 = {
  display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", width: "100%", maxWidth: "650px", margin: "0 auto",
};
const fileBox = {
  backgroundColor: colors.white, padding: "36px 16px", borderRadius: radii.xl,
  textAlign: "center", cursor: "pointer", border: `1px solid ${colors.border}`,
  transition: "transform 0.2s, box-shadow 0.2s",
};
const talentCard = {
  backgroundColor: colors.white, padding: "16px", borderRadius: radii.xl,
  display: "flex", justifyContent: "space-between", alignItems: "center",
  border: `1px solid ${colors.border}`, boxShadow: shadows.sm, cursor: "pointer",
};
const scoreCircle = {
  width: "60px", height: "60px", borderRadius: "50%",
  border: `3px solid ${colors.success}`, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const avatar = {
  width: "42px", height: "42px", borderRadius: "50%",
  backgroundColor: colors.primaryLight, display: "flex", alignItems: "center",
  justifyContent: "center", flexShrink: 0, fontWeight: "700", color: colors.primaryDark, fontSize: "16px",
};
const largeAvatar = {
  width: "56px", height: "56px", borderRadius: "50%",
  backgroundColor: colors.primaryLight, display: "flex", alignItems: "center",
  justifyContent: "center", fontWeight: "800", color: colors.primaryDark, fontSize: "22px",
};
const profileCard = {
  backgroundColor: colors.white, padding: "24px", borderRadius: radii.xl,
  border: `1px solid ${colors.border}`,
};
const infoRow = {
  display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px",
};
const infoLabel = {
  fontSize: "12px", fontWeight: "700", color: colors.textSecondary,
  minWidth: "70px", marginTop: "4px",
};
const skillBadge = {
  fontSize: "12px", padding: "4px 10px", borderRadius: "20px",
  backgroundColor: "#e8f0fe", color: colors.primaryDark, fontWeight: "500",
};
const reqBadge = {
  fontSize: "11px", padding: "4px 10px", borderRadius: "20px",
  backgroundColor: colors.bg, color: colors.textSecondary, fontWeight: "500", border: `1px solid ${colors.border}`,
};
const resumeLink = {
  color: colors.primaryDark, fontSize: "14px", fontWeight: "600", textDecoration: "none",
};
