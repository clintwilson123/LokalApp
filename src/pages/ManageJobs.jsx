import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { colors, radii, dashTable, dashTh, dashTd, dashRow, dashGrid } from "../uiStyles";
import { SkeletonTable } from "../components/Skeleton";
import { aiSkillMatch } from "../lib/aiSkillMatch";

export default function ManageJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [viewingJob, setViewingJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0, name: "" });

  const [form, setForm] = useState({
    title: "",
    company: "CJTECH Computer Trading",
    location: "Sangi, Toledo City",
    salary: "",
    description: "",
    requirements: "",
    icon: "💼",
  });

  const fetchJobs = async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (data) setJobs(data);
    setLoading(false);
  };

  const fetchApplicantsForJob = async (jobId) => {
    const { data: apps } = await supabase
      .from("applications")
      .select("id, user_id, status, score, created_at")
      .eq("job_id", jobId);

    if (!apps || apps.length === 0) {
      setApplicants([]);
      return;
    }

    const userIds = apps.map((a) => a.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, skills, location, phone_number, resume_url, bio")
      .in("id", userIds);

    const job = jobs.find((j) => j.id === jobId);
    const requirements = job?.requirements || [];
    const title = job?.title || "";
    const list = profiles || [];

    setAnalyzing(true);
    setApplicants([]);
    const ranked = [];

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      setAnalyzeProgress({ current: i + 1, total: list.length, name: p.full_name || "Unnamed" });
      await new Promise((r) => setTimeout(r, 700));

      const app = apps.find((a) => a.user_id === p.id);
      ranked.push({ ...p, application: app, match: await aiSkillMatch(p.skills, requirements, title) });
      ranked.sort((a, b) => b.match.score - a.match.score);
      setApplicants([...ranked]);
    }

    setAnalyzing(false);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  function resetForm() {
    setForm({
      title: "",
      company: "CJTECH Computer Trading",
      location: "Sangi, Toledo City",
      salary: "",
      description: "",
      requirements: "",
      icon: "💼",
    });
    setEditing(null);
    setShowForm(false);
  }

  function openEdit(job) {
    setForm({
      title: job.title || "",
      company: job.company || "CJTECH Computer Trading",
      location: job.location || "Sangi, Toledo City",
      salary: job.salary || "",
      description: job.description || "",
      requirements: job.requirements?.join(", ") || "",
      icon: job.icon || "💼",
    });
    setEditing(job.id);
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const payload = {
      ...form,
      requirements: form.requirements.split(",").map((s) => s.trim()).filter(Boolean),
    };

    if (editing) {
      const { error } = await supabase.from("jobs").update(payload).eq("id", editing);
      if (error) { setMessage("Failed to update: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("jobs").insert(payload);
      if (error) { setMessage("Failed to create: " + error.message); setSaving(false); return; }
    }

    setMessage(editing ? "Job updated successfully!" : "Job created successfully!");
    resetForm();
    fetchJobs();
    setSaving(false);
  }

  async function handleDelete(jobId, title) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("jobs").delete().eq("id", jobId);
    if (error) {
      setMessage("Delete failed: " + error.message);
    } else {
      setMessage(`"${title}" deleted.`);
      fetchJobs();
    }
  }

  function viewApplicants(job) {
    setViewingJob(job);
    setSelectedApplicant(null);
    fetchApplicantsForJob(job.id);
  }

  async function updateApplicantStatus(applicationId, newStatus) {
    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", applicationId);
    if (!error) {
      setSelectedApplicant(null);
      fetchApplicantsForJob(viewingJob.id);
    }
  }

  const msg = (text) => {
    const ok = text.includes("success") || text.includes("updated") || text.includes("deleted") || text.includes("created");
    return {
      padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "600",
      backgroundColor: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
      color: ok ? colors.success : colors.danger, textAlign: "center",
    };
  };

  if (viewingJob && !selectedApplicant) {
    const job = viewingJob;
    return (
      <div style={container}>
        <button style={backBtn} onClick={() => { setViewingJob(null); setApplicants([]); }}>
          ← Back to Jobs
        </button>
        <h2 style={{ fontSize: "20px", color: "#fff", fontWeight: "800", margin: "16px 0 4px" }}>
          {job.icon} {job.title}
        </h2>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "0 0 4px" }}>
          {job.company} • {job.location}
        </p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>
          Requirements: {job.requirements?.join(", ") || "None"}
        </p>

        {analyzing ? (
          <div style={analyzingOverlay}>
            <div style={analyzingContent}>
              <span style={{ fontSize: "40px" }}>🧠</span>
              <p style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: "12px 0 4px" }}>
                AI Analyzing Applicants
              </p>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
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
        ) : applicants.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "40px" }}>
            No applicants for this job yet.
          </p>
        ) : (
          <div style={dashGrid}>
            {applicants.map((a) => (
              <div key={a.id} style={candidateCard} onClick={() => setSelectedApplicant(a)}>
                <div style={candidateHeader}>
                  <div style={avatarCircle}>{a.full_name?.[0] || "?"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", color: "#fff", fontSize: "14px" }}>
                      {a.full_name || "Unnamed"}
                    </div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                      {a.location || "No location"}
                    </div>
                  </div>
                  <div style={scoreCircle(a.match.score)}>{a.match.score}%</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                  <span style={aiBadge}>AI</span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                    {a.match.basicScore !== undefined && a.match.basicScore !== a.match.score
                      ? `Basic ${a.match.basicScore}% → ${a.match.score}%`
                      : "AI Skill Match"}
                  </span>
                </div>
                <div style={matchBarOuter}>
                  <div style={matchBarInner(a.match.score)} />
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "8px" }}>
                  Matched {a.match.matched}/{a.match.total} requirements
                </div>
                <div style={{ fontSize: "11px", marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {a.match.matchedItems.slice(0, 3).map((s) => (
                    <span key={s} style={matchTag}>✅ {s}</span>
                  ))}
                  {a.match.matchedItems.length > 3 && (
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>+{a.match.matchedItems.length - 3} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (selectedApplicant) {
    const a = selectedApplicant;
    return (
      <div style={container}>
        <button style={backBtn} onClick={() => setSelectedApplicant(null)}>
          ← Back to applicants
        </button>
        <div style={detailCard}>
          <h3 style={{ color: "#fff", marginBottom: "8px" }}>{a.full_name || "Unnamed"}</h3>
          <div style={scoreLarge}>
            <span style={aiBadge}>AI</span>{" "}
            Match: <strong>{(a.match?.score) || 0}%</strong> ({(a.match?.matched) || 0}/{(a.match?.total) || 0} skills)
          </div>
          {a.match?.explanation && (
            <div style={aiExplanation}>
              <strong>🤖 Gemini Analysis:</strong> {a.match.explanation}
            </div>
          )}
          {a.match?.basicScore !== undefined && a.match.basicScore !== a.match.score && (
            <div style={comparisonRow}>
              <span style={comparisonLabel}>🔍 Basic Match</span>
              <span style={comparisonValue}>{a.match.basicScore}%</span>
              <span style={comparisonArrow}>→</span>
              <span style={{ ...comparisonLabel, color: "#93c5fd" }}>🤖 AI Match</span>
              <span style={{ ...comparisonValue, color: "#93c5fd" }}>{a.match.score}%</span>
            </div>
          )}
          <div style={detailGrid}>
            <div style={detailItem}><strong>Skills:</strong> {a.skills || "Not set"}</div>
            <div style={detailItem}><strong>Location:</strong> {a.location || "Not set"}</div>
            <div style={detailItem}><strong>Phone:</strong> {a.phone_number || "Not set"}</div>
            <div style={detailItem}><strong>Bio:</strong> {a.bio || "Not set"}</div>
            {a.resume_url && (
              <div style={detailItem}>
                <strong>Resume:</strong>{" "}
                <a href={a.resume_url} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>View Resume ↗</a>
              </div>
            )}
            <div style={detailItem}>
              <strong>Status:</strong>{" "}
              <span style={{
                textTransform: "capitalize", fontWeight: "600",
                color: a.application?.status === "hired" ? "#86efac" : a.application?.status === "rejected" ? "#fca5a5" : "#fbbf24",
              }}>
                {a.application?.status || "pending"}
              </span>
            </div>
            {a.application?.status === "pending" && (
              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button onClick={() => updateApplicantStatus(a.application.id, "hired")} style={{
                  flex: 1, padding: "10px", backgroundColor: "#22c55e", color: "#fff", border: "none",
                  borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer",
                }}>Hire</button>
                <button onClick={() => updateApplicantStatus(a.application.id, "rejected")} style={{
                  flex: 1, padding: "10px", backgroundColor: "#ef4444", color: "#fff", border: "none",
                  borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer",
                }}>Reject</button>
              </div>
            )}
            {a.match?.matchedItems?.length > 0 && (
              <div style={detailItem}>
                <strong>Matched Skills:</strong>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  {a.match.matchedItems.map((s) => (<span key={s} style={matchBadge}>{s}</span>))}
                </div>
              </div>
            )}
            {a.match?.missingItems?.length > 0 && (
              <div style={detailItem}>
                <strong>Missing Skills:</strong>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  {a.match.missingItems.map((s) => (<span key={s} style={missingBadge}>{s}</span>))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "5px" }}><SkeletonTable rows={4} cols={7} /></div>;
  }

  return (
    <div style={container}>
      <div style={headerRow}>
        <div>
          <h2 style={{ fontSize: "20px", color: "#fff", fontWeight: "800", margin: "0 0 4px" }}>Manage Jobs</h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>{jobs.length} job{jobs.length !== 1 ? "s" : ""} listed</p>
        </div>
        <button style={addBtn} onClick={() => { resetForm(); setShowForm(true); }}>+ New Job</button>
      </div>

      {message && <p style={msg(message)}>{message}</p>}

      {showForm && (
        <div style={formOverlay}>
          <div style={formModal}>
            <div style={formHeader}>
              <h3 style={{ margin: 0, color: "#fff" }}>{editing ? "Edit Job" : "Create New Job"}</h3>
              <button onClick={resetForm} style={closeBtn}>✕</button>
            </div>
            <div style={formBody}>
              <div style={fieldRow}>
                <div style={fieldHalf}>
                  <label style={label}>Job Title *</label>
                  <input style={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Sales Assistant" />
                </div>
                <div style={fieldHalf}>
                  <label style={label}>Icon</label>
                  <div style={iconGrid}>
                    {JOB_ICONS.map((ic) => (
                      <span key={ic} onClick={() => setForm({ ...form, icon: ic })}
                        style={{
                          ...iconOption,
                          border: form.icon === ic ? "2px solid #93c5fd" : "2px solid transparent",
                          transform: form.icon === ic ? "scale(1.15)" : "scale(1)",
                        }}>
                        {ic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={fieldRow}>
                <div style={fieldHalf}>
                  <label style={label}>Company</label>
                  <input style={input} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div style={fieldHalf}>
                  <label style={label}>Location</label>
                  <input style={input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
              </div>
              <div style={fieldGroup}>
                <label style={label}>Salary</label>
                <input style={input} value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="e.g. ₱15,000 — ₱18,000 / month" />
              </div>
              <div style={fieldGroup}>
                <label style={label}>Description</label>
                <textarea style={{ ...input, minHeight: "80px", resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={fieldGroup}>
                <label style={label}>Requirements (comma-separated)</label>
                <textarea style={{ ...input, minHeight: "60px", resize: "vertical" }} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder="e.g. High school graduate, Good communication, Basic math" />
              </div>
            </div>
            <div style={formFooter}>
              <button onClick={resetForm} style={cancelBtn}>Cancel</button>
              <button onClick={handleSave} style={{ ...saveBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                {saving ? "Saving..." : editing ? "Update Job" : "Create Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={dashTable}>
        <table style={tableStyle}>
          <thead>
            <tr style={dashRow}>
              <th style={dashTh}>Icon</th>
              <th style={dashTh}>Title</th>
              <th style={dashTh}>Company</th>
              <th style={dashTh}>Location</th>
              <th style={dashTh}>Salary</th>
              <th style={dashTh}>Applicants</th>
              <th style={dashTh}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "rgba(255,255,255,0.5)" }}>
                  No jobs yet. Click "+ New Job" to create one.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <JobRow key={job.id} job={job} onEdit={openEdit} onDelete={handleDelete} onViewApplicants={viewApplicants} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobRow({ job, onEdit, onDelete, onViewApplicants }) {
  const [appCount, setAppCount] = useState(null);

  useEffect(() => {
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("job_id", job.id)
      .then(({ count }) => setAppCount(count ?? 0));
  }, [job.id]);

  return (
    <tr style={dashRow}>
      <td style={dashTd}><span style={{ fontSize: "20px" }}>{job.icon || "💼"}</span></td>
      <td style={{ ...dashTd, fontWeight: "600" }}>{job.title}</td>
      <td style={dashTd}>{job.company}</td>
      <td style={dashTd}>{job.location}</td>
      <td style={{ ...dashTd, fontSize: "12px" }}>{job.salary || "—"}</td>
      <td style={{ ...dashTd, textAlign: "center" }}>{appCount ?? "—"}</td>
      <td style={dashTd}>
        <div style={{ display: "flex", gap: "6px" }}>
          <button style={viewBtn} onClick={() => onViewApplicants(job)}>Applicants</button>
          <button style={editBtn} onClick={() => onEdit(job)}>Edit</button>
          <button style={delBtn} onClick={() => onDelete(job.id, job.title)}>Delete</button>
        </div>
      </td>
    </tr>
  );
}

const JOB_ICONS = ["🏪", "🛍️", "💻", "🖥️", "🔧", "🛠️", "⚙️", "🧰", "🔌", "🖱️", "📋", "👥", "💰", "📦", "🎯", "⭐"];

const iconGrid = { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" };
const iconOption = { fontSize: "22px", cursor: "pointer", padding: "4px", borderRadius: "8px", lineHeight: "1" };
const progressWrap = { marginTop: "20px", textAlign: "center" };
const progressTrack = { height: "8px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden", marginBottom: "8px" };
const progressFill = { height: "100%", backgroundColor: "#4a90e2", borderRadius: "4px" };
const progressText = { fontSize: "13px", color: "rgba(255,255,255,0.5)", fontWeight: "500" };
const aiExplanation = { fontSize: "13px", color: "rgba(255,255,255,0.85)", backgroundColor: "rgba(74,144,226,0.1)", padding: "12px", borderRadius: "8px", marginBottom: "16px", lineHeight: "1.5" };
const comparisonRow = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", marginBottom: "16px", padding: "8px 12px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "8px" };
const comparisonLabel = { color: "rgba(255,255,255,0.5)", fontWeight: "500" };
const comparisonValue = { fontWeight: "700", color: "rgba(255,255,255,0.85)" };
const comparisonArrow = { color: "rgba(255,255,255,0.4)" };

const container = { padding: "5px" };
const headerRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" };
const addBtn = { background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: "700", fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 16px rgba(26,115,232,0.3)" };

const formOverlay = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" };
const formModal = { backgroundColor: "rgba(15,23,42,0.95)", borderRadius: radii.xl, width: "100%", maxWidth: "580px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" };
const formHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" };
const closeBtn = { background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "rgba(255,255,255,0.5)", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" };
const formBody = { padding: "20px 24px" };
const formFooter = { display: "flex", justifyContent: "flex-end", gap: "10px", padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.08)" };
const fieldRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const fieldHalf = { marginBottom: "14px" };
const fieldGroup = { marginBottom: "14px" };
const label = { display: "block", fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "4px", fontWeight: "500" };
const input = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", fontSize: "14px", outline: "none", boxSizing: "border-box", backgroundColor: "rgba(255,255,255,0.06)", color: "#fff", fontFamily: "inherit" };
const cancelBtn = { padding: "10px 20px", backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" };
const saveBtn = { padding: "10px 20px", background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px", boxShadow: "0 4px 16px rgba(26,115,232,0.3)" };

const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "700px" };
const editBtn = { padding: "4px 10px", fontSize: "11px", border: "none", borderRadius: "6px", backgroundColor: "rgba(74,144,226,0.2)", color: "#93c5fd", cursor: "pointer", fontWeight: "600" };
const delBtn = { padding: "4px 10px", fontSize: "11px", border: "none", borderRadius: "6px", backgroundColor: "rgba(239,68,68,0.2)", color: "#fca5a5", cursor: "pointer", fontWeight: "600" };
const viewBtn = { padding: "4px 10px", fontSize: "11px", border: "none", borderRadius: "6px", backgroundColor: "rgba(34,197,94,0.2)", color: "#86efac", cursor: "pointer", fontWeight: "600" };

const backBtn = { background: "none", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: "13px", fontWeight: "600", padding: 0, marginBottom: "8px" };
const candidateCard = { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.md, padding: "16px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" };
const candidateHeader = { display: "flex", alignItems: "center", gap: "12px" };
const avatarCircle = { width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px", flexShrink: 0 };
const scoreCircle = (score) => ({ width: "44px", height: "44px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "13px", color: score >= 80 ? "#86efac" : score >= 50 ? "#fbbf24" : "#fca5a5", backgroundColor: score >= 80 ? "rgba(34,197,94,0.2)" : score >= 50 ? "rgba(217,119,6,0.2)" : "rgba(239,68,68,0.2)", flexShrink: 0 });
const matchBarOuter = { height: "6px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "3px", marginTop: "10px", overflow: "hidden" };
const matchBarInner = (score) => ({ height: "100%", borderRadius: "3px", backgroundColor: score >= 80 ? "#22c55e" : score >= 50 ? "#d97706" : "#ef4444", width: `${score}%` });
const matchTag = { fontSize: "11px", color: "#86efac", fontWeight: "500" };
const aiBadge = { fontSize: "9px", fontWeight: "800", padding: "2px 5px", borderRadius: "4px", backgroundColor: "#4a90e2", color: "#fff", letterSpacing: "0.5px" };
const analyzingOverlay = { display: "flex", justifyContent: "center", padding: "60px 20px" };
const analyzingContent = { textAlign: "center" };

const detailCard = { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.lg, padding: "24px", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" };
const scoreLarge = { fontSize: "20px", fontWeight: "700", color: "#fff", marginBottom: "16px" };
const detailGrid = { display: "flex", flexDirection: "column", gap: "12px" };
const detailItem = { fontSize: "13px", color: "rgba(255,255,255,0.85)", lineHeight: "1.6" };
const matchBadge = { fontSize: "11px", padding: "3px 8px", borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.2)", color: "#86efac", fontWeight: "600" };
const missingBadge = { fontSize: "11px", padding: "3px 8px", borderRadius: "12px", backgroundColor: "rgba(239,68,68,0.2)", color: "#fca5a5", fontWeight: "600" };
