import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { colors, radii, shadows } from "../uiStyles";
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

  if (viewingJob && !selectedApplicant) {
    const job = viewingJob;
    return (
      <div style={container}>
        <button style={backBtn} onClick={() => { setViewingJob(null); setApplicants([]); }}>
          ← Back to Jobs
        </button>
        <h2 style={{ fontSize: "20px", color: colors.navy, fontWeight: "800", margin: "16px 0 4px" }}>
          {job.icon} {job.title}
        </h2>
        <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 4px" }}>
          {job.company} • {job.location}
        </p>
        <p style={{ fontSize: "12px", color: colors.textSecondary, margin: "0 0 16px" }}>
          Requirements: {job.requirements?.join(", ") || "None"}
        </p>

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
        ) : applicants.length === 0 ? (
          <p style={{ color: colors.textSecondary, textAlign: "center", padding: "40px" }}>
            No applicants for this job yet.
          </p>
        ) : (
          <div style={grid}>
            {applicants.map((a) => (
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
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                  <span style={aiBadge}>AI</span>
                  <span style={{ fontSize: "11px", color: colors.textSecondary }}>
                    {a.match.basicScore !== undefined && a.match.basicScore !== a.match.score
                      ? `Basic ${a.match.basicScore}% → ${a.match.score}%`
                      : "AI Skill Match"}
                  </span>
                </div>
                <div style={matchBarOuter}>
                  <div style={matchBarInner(a.match.score)} />
                </div>
                <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "8px" }}>
                  Matched {a.match.matched}/{a.match.total} requirements
                </div>
                <div style={{ fontSize: "11px", marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {a.match.matchedItems.slice(0, 3).map((s) => (
                    <span key={s} style={matchTag}>✅ {s}</span>
                  ))}
                  {a.match.matchedItems.length > 3 && (
                    <span style={{ fontSize: "11px", color: colors.textSecondary }}>+{a.match.matchedItems.length - 3} more</span>
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
          <h3 style={{ color: colors.navy, marginBottom: "8px" }}>{a.full_name || "Unnamed"}</h3>
          <div style={scoreLarge}>
            <span style={aiBadge}>AI</span>{" "}
            Match: <strong>{a.match.score}%</strong> ({a.match.matched}/{a.match.total} skills)
          </div>
          {a.match.explanation && (
            <div style={aiExplanation}>
              <strong>🤖 Gemini Analysis:</strong> {a.match.explanation}
            </div>
          )}
          {a.match.basicScore !== undefined && a.match.basicScore !== a.match.score && (
            <div style={comparisonRow}>
              <span style={comparisonLabel}>🔍 Basic Match</span>
              <span style={comparisonValue}>{a.match.basicScore}%</span>
              <span style={comparisonArrow}>→</span>
              <span style={{ ...comparisonLabel, color: "#1a73e8" }}>🤖 AI Match</span>
              <span style={{ ...comparisonValue, color: "#1a73e8" }}>{a.match.score}%</span>
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
                <a href={a.resume_url} target="_blank" rel="noreferrer" style={{ color: colors.primaryDark }}>View Resume ↗</a>
              </div>
            )}
            <div style={detailItem}>
              <strong>Status:</strong>{" "}
              <span style={{
                textTransform: "capitalize", fontWeight: "600",
                color: a.application?.status === "hired" ? "#22c55e" : a.application?.status === "rejected" ? "#f87171" : "#d97706",
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
                  flex: 1, padding: "10px", backgroundColor: "#f87171", color: "#fff", border: "none",
                  borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer",
                }}>Reject</button>
              </div>
            )}
            {a.match.matchedItems.length > 0 && (
              <div style={detailItem}>
                <strong>Matched Skills:</strong>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  {a.match.matchedItems.map((s) => (<span key={s} style={matchBadge}>{s}</span>))}
                </div>
              </div>
            )}
            {a.match.missingItems.length > 0 && (
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
          <h2 style={{ fontSize: "20px", color: colors.navy, fontWeight: "800", margin: "0 0 4px" }}>Manage Jobs</h2>
          <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0 }}>{jobs.length} job{jobs.length !== 1 ? "s" : ""} listed</p>
        </div>
        <button style={addBtn} onClick={() => { resetForm(); setShowForm(true); }}>+ New Job</button>
      </div>

      {message && (
        <p style={{
          padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "600",
          backgroundColor: message.includes("success") || message.includes("updated") || message.includes("deleted") || message.includes("created") ? "#e2f9eb" : "#fee2e2",
          color: message.includes("success") || message.includes("updated") || message.includes("deleted") || message.includes("created") ? colors.success : colors.danger,
          textAlign: "center",
        }}>
          {message}
        </p>
      )}

      {showForm && (
        <div style={formOverlay}>
          <div style={formModal}>
            <div style={formHeader}>
              <h3 style={{ margin: 0, color: colors.navy }}>{editing ? "Edit Job" : "Create New Job"}</h3>
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
                          border: form.icon === ic ? `2px solid ${colors.primaryDark}` : "2px solid transparent",
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

      <div style={tableWrapper}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
              <th style={thStyle}>Icon</th>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Company</th>
              <th style={thStyle}>Location</th>
              <th style={thStyle}>Salary</th>
              <th style={thStyle}>Applicants</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: colors.textSecondary }}>
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
    <tr style={rowStyle}>
      <td style={tdStyle}><span style={{ fontSize: "20px" }}>{job.icon || "💼"}</span></td>
      <td style={{ ...tdStyle, fontWeight: "600", color: colors.navy }}>{job.title}</td>
      <td style={tdStyle}>{job.company}</td>
      <td style={tdStyle}>{job.location}</td>
      <td style={{ ...tdStyle, fontSize: "12px" }}>{job.salary || "—"}</td>
      <td style={{ ...tdStyle, textAlign: "center" }}>{appCount ?? "—"}</td>
      <td style={tdStyle}>
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
const iconOption = { fontSize: "22px", cursor: "pointer", padding: "4px", borderRadius: "8px", transition: "all 0.15s", lineHeight: "1" };
const progressWrap = { marginTop: "20px", textAlign: "center" };
const progressTrack = { height: "8px", backgroundColor: colors.bg, borderRadius: "4px", overflow: "hidden", marginBottom: "8px" };
const progressFill = { height: "100%", backgroundColor: colors.primaryDark, borderRadius: "4px", transition: "width 0.4s" };
const progressText = { fontSize: "13px", color: colors.textSecondary, fontWeight: "500" };
const aiExplanation = { fontSize: "13px", color: colors.navy, backgroundColor: "#1a73e810", padding: "12px", borderRadius: "8px", marginBottom: "16px", lineHeight: "1.5" };
const comparisonRow = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", marginBottom: "16px", padding: "8px 12px", backgroundColor: colors.bg, borderRadius: "8px" };
const comparisonLabel = { color: colors.textSecondary, fontWeight: "500" };
const comparisonValue = { fontWeight: "700", color: colors.navy };
const comparisonArrow = { color: colors.textSecondary };

const container = { padding: "5px" };
const headerRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" };
const addBtn = { backgroundColor: colors.primaryDark, color: "#fff", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: "700", fontSize: "13px", cursor: "pointer" };

const formOverlay = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" };
const formModal = { backgroundColor: "#fff", borderRadius: radii.xl, width: "100%", maxWidth: "580px", maxHeight: "90vh", overflow: "auto", boxShadow: shadows.xl };
const formHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${colors.border}` };
const closeBtn = { background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: colors.textSecondary, width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" };
const formBody = { padding: "20px 24px" };
const formFooter = { display: "flex", justifyContent: "flex-end", gap: "10px", padding: "16px 24px", borderTop: `1px solid ${colors.border}` };
const fieldRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const fieldHalf = { marginBottom: "14px" };
const fieldGroup = { marginBottom: "14px" };
const label = { display: "block", fontSize: "12px", color: colors.textSecondary, marginBottom: "4px", fontWeight: "500" };
const input = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: `1px solid ${colors.border}`, fontSize: "14px", outline: "none", boxSizing: "border-box", backgroundColor: colors.white, fontFamily: "inherit" };
const cancelBtn = { padding: "10px 20px", backgroundColor: colors.bg, color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" };
const saveBtn = { padding: "10px 20px", backgroundColor: colors.primaryDark, color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px" };

const tableWrapper = { backgroundColor: "rgba(255,255,255,0.7)", borderRadius: radii.lg, padding: "16px", boxShadow: shadows.sm, overflowX: "auto" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "700px" };
const thStyle = { padding: "10px", color: colors.textSecondary, fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap" };
const rowStyle = { borderBottom: `1px solid ${colors.border}` };
const tdStyle = { padding: "10px", fontSize: "13px", color: colors.navy };
const editBtn = { padding: "4px 10px", fontSize: "11px", border: "none", borderRadius: "6px", backgroundColor: colors.primaryLight, color: colors.primaryDark, cursor: "pointer", fontWeight: "600" };
const delBtn = { padding: "4px 10px", fontSize: "11px", border: "none", borderRadius: "6px", backgroundColor: "#fee2e2", color: colors.danger, cursor: "pointer", fontWeight: "600" };
const viewBtn = { padding: "4px 10px", fontSize: "11px", border: "none", borderRadius: "6px", backgroundColor: "#22c55e20", color: "#22c55e", cursor: "pointer", fontWeight: "600" };

const backBtn = { background: "none", border: "none", color: colors.primaryDark, cursor: "pointer", fontSize: "13px", fontWeight: "600", padding: 0, marginBottom: "8px" };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const candidateCard = { backgroundColor: colors.white, borderRadius: radii.md, padding: "16px", boxShadow: shadows.sm, cursor: "pointer", border: `1px solid ${colors.border}` };
const candidateHeader = { display: "flex", alignItems: "center", gap: "12px" };
const avatarCircle = { width: "36px", height: "36px", borderRadius: "50%", backgroundColor: colors.primaryDark, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px", flexShrink: 0 };
const scoreCircle = (score) => ({ width: "44px", height: "44px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "13px", color: score >= 80 ? "#22c55e" : score >= 50 ? "#d97706" : "#f87171", backgroundColor: score >= 80 ? "#22c55e20" : score >= 50 ? "#d9770620" : "#f8717120", flexShrink: 0 });
const matchBarOuter = { height: "6px", backgroundColor: colors.bg, borderRadius: "3px", marginTop: "10px", overflow: "hidden" };
const matchBarInner = (score) => ({ height: "100%", borderRadius: "3px", backgroundColor: score >= 80 ? "#22c55e" : score >= 50 ? "#d97706" : "#f87171", width: `${score}%`, transition: "width 0.3s" });
const matchTag = { fontSize: "11px", color: "#22c55e", fontWeight: "500" };
const aiBadge = { fontSize: "9px", fontWeight: "800", padding: "2px 5px", borderRadius: "4px", backgroundColor: "#1a73e8", color: "#fff", letterSpacing: "0.5px" };
const analyzingOverlay = { display: "flex", justifyContent: "center", padding: "60px 20px" };
const analyzingContent = { textAlign: "center" };

const detailCard = { backgroundColor: colors.white, borderRadius: radii.lg, padding: "24px", boxShadow: shadows.md };
const scoreLarge = { fontSize: "20px", fontWeight: "700", color: colors.navy, marginBottom: "16px" };
const detailGrid = { display: "flex", flexDirection: "column", gap: "12px" };
const detailItem = { fontSize: "13px", color: colors.navy, lineHeight: "1.6" };
const matchBadge = { fontSize: "11px", padding: "3px 8px", borderRadius: "12px", backgroundColor: "#22c55e20", color: "#22c55e", fontWeight: "600" };
const missingBadge = { fontSize: "11px", padding: "3px 8px", borderRadius: "12px", backgroundColor: "#f8717120", color: "#f87171", fontWeight: "600" };
