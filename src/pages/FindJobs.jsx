import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { colors, radii } from "../uiStyles";
import { SkeletonGrid } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import { computeSkillMatch } from "../lib/skillMatch";

export default function FindJobs() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchJobs = async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (data) setJobs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const filtered = jobs.filter(j =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div style={{ padding: "5px" }}><SkeletonGrid cards={4} /></div>;
  }

  return (
    <div style={container}>
      <div style={searchWrap}>
        <span style={searchIcon}>🔍</span>
        <input
          style={searchInput}
          placeholder="Search job title or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button style={clearBtn} onClick={() => setSearch("")}>✕</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <span style={{ fontSize: "48px", display: "block", marginBottom: "12px", opacity: 0.3 }}>🔍</span>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", marginBottom: "4px", fontWeight: "500" }}>
            {search ? "No jobs match your search" : "No job openings right now"}
          </p>
          {!search && (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
              Check back later for new opportunities.
            </p>
          )}
        </div>
      ) : (
        <>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "16px", fontWeight: "500" }}>
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
                    <span style={{ ...reqChip, backgroundColor: "rgba(74,144,226,0.2)", color: "#93c5fd" }}>
                      +{job.requirements.length - 3}
                    </span>
                  )}
                </div>
                {profile?.skills && job.requirements?.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    {(() => {
                      const match = computeSkillMatch(profile.skills, job.requirements);
                      const color = match.score >= 70 ? colors.success : match.score >= 40 ? colors.warning : colors.danger;
                      return (
                        <span style={{
                          fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "20px",
                          backgroundColor: color + "30", color,
                        }}>
                          {match.score}% Match
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const container = { width: "100%", maxWidth: "800px", margin: "0 auto" };
const searchWrap = {
  position: "relative", marginBottom: "20px",
};
const searchIcon = {
  position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
  fontSize: "16px", pointerEvents: "none", opacity: 0.4,
};
const searchInput = {
  width: "100%", padding: "12px 16px 12px 40px", borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.15)", fontSize: "14px", outline: "none",
  boxSizing: "border-box", backgroundColor: "rgba(255,255,255,0.06)", color: "#fff",

};
const clearBtn = {
  position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", fontSize: "14px", cursor: "pointer",
  color: "rgba(255,255,255,0.5)", padding: "4px", lineHeight: "1",
};
const jobGrid = {
  display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", width: "100%",
};
const jobCard = {
  backgroundColor: "rgba(255,255,255,0.06)", padding: "20px", borderRadius: radii.xl,
  cursor: "pointer", display: "flex", flexDirection: "column",
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(12px)",
};
const cardTop = { display: "flex", alignItems: "center", gap: "14px", marginBottom: "12px" };
const iconCircle = {
  width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(74,144,226,0.2)",
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0,
};
const jobTitleText = { color: "#fff", fontSize: "16px", fontWeight: "800", margin: "0 0 2px 0" };
const companyText = { color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: "500", margin: 0 };
const detailChip = {
  fontSize: "11px", color: "rgba(255,255,255,0.5)", fontWeight: "500",
};
const descText = {
  color: "rgba(255,255,255,0.6)", fontSize: "13px", lineHeight: "1.5", margin: "0 0 12px 0", flex: 1,
};
const reqChip = {
  fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
  backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", fontWeight: "500",
};
