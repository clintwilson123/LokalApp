import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { colors, radii, shadows } from "../uiStyles";
import { SkeletonLine, SkeletonCard } from "../components/Skeleton";
import { aiSkillMatch } from "../lib/aiSkillMatch";

export default function AdminApplicants() {
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rankedApplicants, setRankedApplicants] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0, name: "" });

  useEffect(() => {
    Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, skills, location, phone_number, resume_url, bio, created_at")
        .eq("role", "applicant"),
    ]).then(([jobsRes, appsRes]) => {
      if (jobsRes.data) setJobs(jobsRes.data);
      if (appsRes.data) setApplicants(appsRes.data);
      setLoading(false);
    });
  }, []);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  useEffect(() => {
    if (!selectedJob) { setRankedApplicants([]); return; }
    const requirements = selectedJob.requirements || [];
    const title = selectedJob.title || "";

    setAnalyzing(true);
    setRankedApplicants([]);

    (async () => {
      const ranked = [];
      for (let i = 0; i < applicants.length; i++) {
        const a = applicants[i];
        setAnalyzeProgress({ current: i + 1, total: applicants.length, name: a.full_name || "Unnamed" });
        await new Promise((r) => setTimeout(r, 700));
        ranked.push({ ...a, match: await aiSkillMatch(a.skills, requirements, title) });
        ranked.sort((a, b) => b.match.score - a.match.score);
        setRankedApplicants([...ranked]);
      }
      setAnalyzing(false);
    })();
  }, [selectedJobId, applicants]);

  if (loading) {
    return (
      <div style={{ padding: "5px" }}>
        <SkeletonLine width="200px" height="24px" />
        <div style={{ height: "16px" }} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (selectedApplicant) {
    const match = selectedJob ? selectedApplicant.match : null;
    return (
      <div style={container}>
        <button style={backBtn} onClick={() => setSelectedApplicant(null)}>
          ← Back to applicants
        </button>
        <div style={detailCard}>
          <h3 style={{ color: colors.navy, marginBottom: "16px" }}>
            {selectedApplicant.full_name || "Unnamed"}
          </h3>
          {match && (
            <div style={scoreLarge}>
              <span style={aiBadge}>AI</span>{" "}
              Match: <strong>{match.score}%</strong> ({match.matched}/{match.total} skills)
            </div>
          )}
          {match?.explanation && (
            <div style={aiExplanation}>
              <strong>🤖 Gemini Analysis:</strong> {match.explanation}
            </div>
          )}
          {match?.basicScore !== undefined && match?.basicScore !== match?.score && (
            <div style={comparisonRow}>
              <span style={comparisonLabel}>🔍 Basic Match</span>
              <span style={comparisonValue}>{match.basicScore}%</span>
              <span style={comparisonArrow}>→</span>
              <span style={{ ...comparisonLabel, color: "#1a73e8" }}>🤖 AI Match</span>
              <span style={{ ...comparisonValue, color: "#1a73e8" }}>{match.score}%</span>
            </div>
          )}
          <div style={detailGrid}>
            <div style={detailItem}>
              <strong>Skills:</strong> {selectedApplicant.skills || "Not set"}
            </div>
            <div style={detailItem}>
              <strong>Location:</strong> {selectedApplicant.location || "Not set"}
            </div>
            <div style={detailItem}>
              <strong>Phone:</strong> {selectedApplicant.phone_number || "Not set"}
            </div>
            <div style={detailItem}>
              <strong>Bio:</strong> {selectedApplicant.bio || "Not set"}
            </div>
            {selectedApplicant.resume_url && (
              <div style={detailItem}>
                <strong>Resume:</strong>{" "}
                <a href={selectedApplicant.resume_url} target="_blank" rel="noreferrer" style={{ color: colors.primaryDark }}>
                  View Resume ↗
                </a>
              </div>
            )}
            {match && match.matchedItems.length > 0 && (
              <div style={detailItem}>
                <strong>Matched Skills:</strong>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  {match.matchedItems.map((s) => (
                    <span key={s} style={matchBadge}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {match && match.missingItems.length > 0 && (
              <div style={detailItem}>
                <strong>Missing Skills:</strong>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  {match.missingItems.map((s) => (
                    <span key={s} style={missingBadge}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <h2 style={{ fontSize: "20px", color: colors.navy, fontWeight: "800", margin: "0 0 4px" }}>
        Applicants
      </h2>
      <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 20px" }}>
        {applicants.length} applicant{applicants.length !== 1 ? "s" : ""} registered
      </p>

      <div style={fieldGroup}>
        <label style={label}>Select a job to rank applicants by skill match:</label>
        <select
          style={select}
          value={selectedJobId || ""}
          onChange={(e) => {
            setSelectedJobId(e.target.value ? parseInt(e.target.value) : null);
            setSelectedApplicant(null);
          }}
        >
          <option value="">-- Choose a job --</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.icon} {job.title}
            </option>
          ))}
        </select>
      </div>

      {selectedJob && (
        <>
          <div style={jobInfo}>
            <strong>{selectedJob.icon} {selectedJob.title}</strong> — {selectedJob.company}, {selectedJob.location}
            <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "4px" }}>
              Requirements: {selectedJob.requirements?.join(", ") || "None"}
            </div>
          </div>

          {analyzing ? (
            <div style={analyzingOverlay}>
              <div style={analyzingContent}>
                <span style={{ fontSize: "40px" }}>🧠</span>
                <p style={{ fontSize: "16px", fontWeight: "700", color: colors.navy, margin: "12px 0 4px" }}>
                  AI Analyzing Applicants
                </p>
                <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0 }}>
                  Gemini comparing skills against job requirements...
                </p>
                <div style={progressWrap}>
                  <div style={progressTrack}>
                    <div style={{ ...progressFill, width: `${(analyzeProgress.current / analyzeProgress.total) * 100}%` }} />
                  </div>
                  <span style={progressText}>
                    {analyzeProgress.current}/{analyzeProgress.total} — {analyzeProgress.name}
                  </span>
                </div>
              </div>
            </div>
          ) : rankedApplicants.length === 0 ? (
            <p style={{ color: colors.textSecondary, textAlign: "center", padding: "40px" }}>
              No applicants with skills found.
            </p>
          ) : (
            <div style={grid}>
              {rankedApplicants.map((a) => (
                <div key={a.id} style={candidateCard} onClick={() => setSelectedApplicant(a)}>
                  <div style={candidateHeader}>
                    <div style={avatarCircle}>{a.full_name?.[0] || "?"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", color: colors.navy, fontSize: "14px" }}>
                        {a.full_name || "Unnamed"}
                      </div>
                      <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                        {a.location || "No location"}
                      </div>
                    </div>
                    <div style={scoreCircle(a.match.score)}>{a.match.score}%</div>
                  </div>
                  {a.match?.basicScore !== undefined && a.match.basicScore !== a.match.score && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <span style={{ fontSize: "10px", color: colors.textSecondary }}>🔍 {a.match.basicScore}%</span>
                      <span style={{ fontSize: "10px", color: colors.textSecondary }}>→</span>
                      <span style={aiBadge}>AI</span>
                      <span style={{ fontSize: "10px", color: "#1a73e8", fontWeight: "600" }}>{a.match.score}%</span>
                    </div>
                  )}
                  {!a.match?.basicScore || a.match.basicScore === a.match.score ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <span style={aiBadge}>AI</span>
                      <span style={{ fontSize: "11px", color: colors.textSecondary }}>Skill Match</span>
                    </div>
                  ) : null}
                  <div style={matchBar}>
                    <div style={matchBarFill(a.match.score)} />
                  </div>
                  <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "8px" }}>
                    Matched {a.match.matched}/{a.match.total} requirements
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const scoreCircle = (score) => ({
  width: "44px", height: "44px", borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: "800", fontSize: "13px",
  color: score >= 80 ? "#22c55e" : score >= 50 ? "#d97706" : "#f87171",
  backgroundColor: score >= 80 ? "#22c55e20" : score >= 50 ? "#d9770620" : "#f8717120",
  flexShrink: 0,
});

const container = { padding: "5px" };
const fieldGroup = { marginBottom: "16px" };
const label = { display: "block", fontSize: "12px", color: colors.textSecondary, marginBottom: "4px", fontWeight: "500" };
const select = {
  width: "100%", padding: "10px 12px", borderRadius: "8px", border: `1px solid ${colors.border}`,
  fontSize: "14px", outline: "none", backgroundColor: colors.white, cursor: "pointer",
};
const jobInfo = {
  backgroundColor: colors.white, padding: "14px 16px", borderRadius: radii.md,
  marginBottom: "20px", border: `1px solid ${colors.border}`, fontSize: "14px", color: colors.navy,
};
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const candidateCard = {
  backgroundColor: colors.white, borderRadius: radii.md, padding: "16px",
  boxShadow: shadows.sm, cursor: "pointer", border: `1px solid ${colors.border}`,
  transition: "all 0.15s",
};
const candidateHeader = { display: "flex", alignItems: "center", gap: "12px" };
const avatarCircle = {
  width: "36px", height: "36px", borderRadius: "50%",
  backgroundColor: colors.primaryDark, color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: "700", fontSize: "14px", flexShrink: 0,
};
const matchBar = {
  height: "6px", backgroundColor: colors.bg, borderRadius: "3px", marginTop: "10px", overflow: "hidden",
};
const matchBarFill = (score) => ({
  height: "100%", borderRadius: "3px",
  backgroundColor: score >= 80 ? "#22c55e" : score >= 50 ? "#d97706" : "#f87171",
  width: `${score}%`, transition: "width 0.3s",
});
const backBtn = {
  background: "none", border: "none", color: colors.primaryDark, cursor: "pointer",
  fontSize: "13px", fontWeight: "600", padding: 0, marginBottom: "16px",
};
const detailCard = {
  backgroundColor: colors.white, borderRadius: radii.lg, padding: "24px",
  boxShadow: shadows.md,
};
const scoreLarge = {
  fontSize: "24px", fontWeight: "700", color: colors.navy, marginBottom: "16px",
};
const detailGrid = { display: "flex", flexDirection: "column", gap: "12px" };
const detailItem = { fontSize: "13px", color: colors.navy, lineHeight: "1.6" };
const matchBadge = {
  fontSize: "11px", padding: "3px 8px", borderRadius: "12px",
  backgroundColor: "#22c55e20", color: "#22c55e", fontWeight: "600",
};
const missingBadge = {
  fontSize: "11px", padding: "3px 8px", borderRadius: "12px",
  backgroundColor: "#f8717120", color: "#f87171", fontWeight: "600",
};
const aiBadge = { fontSize: "9px", fontWeight: "800", padding: "2px 5px", borderRadius: "4px", backgroundColor: "#1a73e8", color: "#fff", letterSpacing: "0.5px" };
const analyzingOverlay = { display: "flex", justifyContent: "center", padding: "60px 20px" };
const analyzingContent = { textAlign: "center" };
const aiExplanation = { fontSize: "13px", color: colors.navy, backgroundColor: "#1a73e810", padding: "12px", borderRadius: "8px", marginBottom: "16px", lineHeight: "1.5" };
const comparisonRow = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", marginBottom: "16px", padding: "8px 12px", backgroundColor: colors.bg, borderRadius: "8px" };
const comparisonLabel = { color: colors.textSecondary, fontWeight: "500" };
const comparisonValue = { fontWeight: "700", color: colors.navy };
const comparisonArrow = { color: colors.textSecondary };
const progressWrap = { marginTop: "20px", textAlign: "center" };
const progressTrack = { height: "8px", backgroundColor: colors.bg, borderRadius: "4px", overflow: "hidden", marginBottom: "8px" };
const progressFill = { height: "100%", backgroundColor: colors.primaryDark, borderRadius: "4px", transition: "width 0.4s" };
const progressText = { fontSize: "13px", color: colors.textSecondary, fontWeight: "500" };
