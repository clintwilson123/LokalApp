import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { colors, radii, shadows } from "../uiStyles";

export default function FindJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (data) setJobs(data);
    setLoading(false);
  }

  const filtered = jobs.filter(j =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: colors.textSecondary }}>Loading jobs...</div>;
  }

  return (
    <div style={container}>
      <input
        style={searchInput}
        placeholder="Search job title or description..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: colors.textSecondary, fontSize: "15px", marginBottom: "8px" }}>
            {search ? "No jobs match your search" : "No job openings available right now."}
          </p>
          {!search && (
            <p style={{ color: colors.textSecondary, fontSize: "13px" }}>
              Check back later for new opportunities.
            </p>
          )}
        </div>
      ) : (
        <>
          <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "16px" }}>
            {filtered.length} job{filtered.length !== 1 ? "s" : ""} found
          </p>
          <div style={jobGrid}>
            {filtered.map((job) => (
              <div key={job.id} style={jobCard} onClick={() => navigate(`/apply-job/${job.id}`)}>
                <div style={cardTop}>
                  <div style={iconCircle}>{job.icon || "💼"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={jobTitleText}>{job.title}</h3>
                    <p style={companyText}>{job.company}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                  <span style={detailChip}>📍 {job.location}</span>
                  {job.salary && <span style={detailChip}>💰 {job.salary}</span>}
                </div>
                <p style={descText}>
                  {job.description?.length > 100 ? job.description.slice(0, 100) + "..." : job.description}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "auto" }}>
                  {job.requirements?.slice(0, 3).map((r, i) => (
                    <span key={i} style={reqChip}>{r}</span>
                  ))}
                  {(job.requirements?.length || 0) > 3 && (
                    <span style={{ ...reqChip, backgroundColor: colors.primaryLight, color: colors.primaryDark }}>
                      +{job.requirements.length - 3}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const container = { width: "100%", maxWidth: "800px", margin: "0 auto" };
const searchInput = {
  width: "100%", padding: "12px 16px", borderRadius: "12px", border: `1px solid ${colors.border}`,
  fontSize: "14px", outline: "none", marginBottom: "20px", boxSizing: "border-box",
  backgroundColor: colors.white,
};
const jobGrid = {
  display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", width: "100%",
};
const jobCard = {
  backgroundColor: colors.white, padding: "20px", borderRadius: radii.xl,
  cursor: "pointer", boxShadow: shadows.md, display: "flex", flexDirection: "column",
  transition: "transform 0.2s ease, box-shadow 0.2s ease", border: "1px solid transparent",
};
const cardTop = { display: "flex", alignItems: "center", gap: "14px", marginBottom: "12px" };
const iconCircle = {
  width: "48px", height: "48px", borderRadius: "50%", backgroundColor: colors.primaryLight,
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0,
};
const jobTitleText = { color: colors.navy, fontSize: "16px", fontWeight: "800", margin: "0 0 2px 0" };
const companyText = { color: colors.textSecondary, fontSize: "12px", fontWeight: "500", margin: 0 };
const detailChip = {
  fontSize: "11px", color: colors.textSecondary, fontWeight: "500",
};
const descText = {
  color: colors.textSecondary, fontSize: "13px", lineHeight: "1.5", margin: "0 0 12px 0", flex: 1,
};
const reqChip = {
  fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
  backgroundColor: colors.bg, color: colors.textSecondary, fontWeight: "500",
};
