import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { radii } from "../uiStyles";
import { SkeletonCard } from "../components/Skeleton";

export default function MyApplications() {
  const { user, profile } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);

  const fetchApplications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("applications")
      .select("id, job_id, status, score, created_at, jobs(title, company, location, icon, description, salary, requirements)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setApplications(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from("applications").delete().eq("id", id);
      if (error) throw error;
      setConfirmingDelete(null);
      fetchApplications();
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }

  async function handleReapply(application) {
    try {
      const { error: updateErr } = await supabase
        .from("applications")
        .update({ status: "pending" })
        .eq("id", application.id);
      if (updateErr) throw updateErr;

      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: user.id,
        message: `You re-applied for ${application.jobs?.title}. The admin will review your application.`,
        type: "info",
      });
      if (notifErr) throw notifErr;

      fetchApplications();
    } catch (err) {
      alert("Failed to re-apply: " + err.message);
    }
  }

  const statusBadge = (status) => {
    const map = {
      pending: { bg: "rgba(217,119,6,0.2)", color: "#fbbf24" },
      reviewed: { bg: "rgba(26,115,232,0.2)", color: "#93c5fd" },
      interview_scheduled: { bg: "rgba(139,92,246,0.2)", color: "#c4b5fd" },
      interviewed: { bg: "rgba(139,92,246,0.2)", color: "#c4b5fd" },
      accepted: { bg: "rgba(34,197,94,0.2)", color: "#86efac" },
      rejected: { bg: "rgba(248,113,113,0.2)", color: "#fca5a5" },
      hired: { bg: "rgba(34,197,94,0.2)", color: "#86efac" },
    };
    const s = map[status] || map.pending;
    return {
      fontSize: "11px", padding: "3px 10px", borderRadius: "20px",
      fontWeight: "600", backgroundColor: s.bg, color: s.color, textTransform: "capitalize",
    };
  };

  const statusSteps = ["pending", "reviewed", "interview_scheduled", "accepted", "hired"];

  const StatusTimeline = ({ currentStatus }) => {
    if (currentStatus === "rejected") {
      return (
        <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "rgba(248,113,113,0.1)", marginBottom: "16px" }}>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#fca5a5" }}>
            Application not selected
          </span>
        </div>
      );
    }
    const currentIndex = statusSteps.indexOf(currentStatus);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "16px", flexWrap: "wrap" }}>
        {statusSteps.map((step, i) => {
          const isActive = i <= currentIndex;
          const isCurrent = step === currentStatus;
          return (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{
                width: "20px", height: "20px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", fontWeight: "700",
                backgroundColor: isActive ? "#4a90e2" : "rgba(255,255,255,0.1)",
                color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
                border: isCurrent ? "2px solid #93c5fd" : "none",
              }}>
                {isActive ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: "10px", fontWeight: isCurrent ? "700" : "500",
                color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
                textTransform: "capitalize",
              }}>
                {step.replace("_", " ")}
              </span>
              {i < statusSteps.length - 1 && (
                <div style={{
                  width: "20px", height: "2px",
                  backgroundColor: i < currentIndex ? "#4a90e2" : "rgba(255,255,255,0.1)",
                }} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (selectedApp) {
    const app = selectedApp;
    const job = app.jobs || {};
    return (
      <div style={container}>
        <button style={backBtn} onClick={() => setSelectedApp(null)}>
          ← Back to Applications
        </button>

        <div style={detailCard}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <span style={{ fontSize: "36px" }}>{job.icon || "💼"}</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: "18px", fontWeight: "800" }}>{job.title}</h3>
              <p style={{ margin: "2px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
                {job.company} • {job.location}
              </p>
            </div>
            <span style={statusBadge(app.status)}>{app.status}</span>
          </div>

          {job.salary && (
            <div style={detailRow}><strong>Salary:</strong> {job.salary}</div>
          )}
          {job.description && (
            <div style={detailRow}><strong>Description:</strong> {job.description}</div>
          )}
          {job.requirements && job.requirements.length > 0 && (
            <div style={detailRow}>
              <strong>Requirements:</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                {job.requirements.map((r, i) => (
                  <span key={i} style={reqTag}>{r}</span>
                ))}
              </div>
            </div>
          )}

          <div style={divider} />

          <h4 style={{ color: "#fff", fontSize: "14px", fontWeight: "700", margin: "0 0 8px" }}>Application Progress</h4>
          <StatusTimeline currentStatus={app.status} />

          <div style={detailRow}>
            <strong>Application Status:</strong>{" "}
            <span style={statusBadge(app.status)}>{app.status?.replace("_", " ")}</span>
          </div>
          <div style={detailRow}>
            <strong>Applied:</strong> {new Date(app.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
          {app.score && (
            <div style={detailRow}>
              <strong>Match Score:</strong>{" "}
              <span style={{ color: "#93c5fd", fontWeight: "700" }}>{app.score}%</span>
            </div>
          )}

          <div style={divider} />

          <h4 style={{ color: "#fff", fontSize: "14px", fontWeight: "700", margin: "0 0 12px" }}>Your Profile</h4>
          <div style={detailRow}>
            <strong>Skills:</strong> {profile?.skills || "Not set"}
          </div>
          <div style={detailRow}>
            <strong>Bio:</strong> {profile?.bio || "Not set"}
          </div>
          {profile?.resume_url && (
            <div style={detailRow}>
              <strong>Resume:</strong>{" "}
              <a href={profile.resume_url} target="_blank" rel="noreferrer" style={resumeLink}>
                📄 View Resume ↗
              </a>
            </div>
          )}

          <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
            {app.status === "pending" && (
              <span style={infoMsg}>⏳ Your application is under review.</span>
            )}
            {app.status === "reviewed" && (
              <span style={infoMsg}>📋 Your application has been reviewed.</span>
            )}
            {app.status === "interview_scheduled" && (
              <span style={infoMsg}>📅 An interview has been scheduled. Check your details.</span>
            )}
            {app.status === "interviewed" && (
              <span style={infoMsg}>🤝 You have been interviewed. Awaiting decision.</span>
            )}
            {app.status === "accepted" && (
              <span style={{ ...infoMsg, color: "#86efac" }}>✅ Your application has been accepted!</span>
            )}
            {app.status === "hired" && (
              <span style={{ ...infoMsg, color: "#86efac" }}>🎉 Congratulations! You're hired!</span>
            )}
            {app.status === "rejected" && (
              <span style={{ ...infoMsg, color: "#fca5a5" }}>💔 Unfortunately, your application was not selected.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "5px" }}><SkeletonCard lines={2} /></div>;
  }

  return (
    <div style={container}>
      <h2 style={{ fontSize: "20px", color: "#fff", fontWeight: "800", margin: "0 0 4px" }}>My Applications</h2>
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "0 0 20px" }}>
        {applications.length} application{applications.length !== 1 ? "s" : ""} submitted
      </p>

      {applications.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <span style={{ fontSize: "48px", display: "block", marginBottom: "12px", opacity: 0.3 }}>📋</span>
          <p style={{ color: "rgba(255,255,255,0.6)", fontWeight: "500" }}>You haven't applied to any jobs yet.</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Browse jobs and submit your first application!</p>
        </div>
      ) : (
        <div style={grid}>
          {applications.map((app) => (
            <div key={app.id} style={card}>
              <div style={cardTop}>
                <span style={{ fontSize: "28px" }}>{app.jobs?.icon || "💼"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, color: "#fff", fontSize: "15px" }}>{app.jobs?.title}</h4>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                    {app.jobs?.company} • {app.jobs?.location}
                  </p>
                </div>
                <span style={statusBadge(app.status)}>{app.status}</span>
              </div>
              <div style={cardBottom}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                  Applied: {new Date(app.created_at).toLocaleDateString()}
                </span>
                {app.score && (
                  <span style={{
                    fontSize: "12px", fontWeight: "700", color: "#93c5fd",
                    background: "rgba(74,144,226,0.2)", padding: "2px 8px", borderRadius: "12px",
                  }}>
                    Score: {app.score}%
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button onClick={() => setSelectedApp(app)} style={viewBtn}>
                  👁️ View Details
                </button>
                {app.status === "rejected" && confirmingDelete === app.id ? (
                  <div style={{ display: "flex", gap: "8px", flex: 1 }}>
                    <button onClick={() => handleDelete(app.id)} style={deleteConfirmBtn}>Yes, Delete</button>
                    <button onClick={() => setConfirmingDelete(null)} style={cancelBtn}>Cancel</button>
                  </div>
                ) : app.status === "rejected" ? (
                  <>
                    <button onClick={() => handleReapply(app)} style={reapplyBtn}>🔄 Apply Again</button>
                    <button onClick={() => setConfirmingDelete(app.id)} style={deleteBtn}>🗑️</button>
                  </>
                ) : null}
              </div>
              {app.status === "hired" && (
                <div style={hiredMsg}>✅ You're hired for this position!</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const container = { padding: "5px" };
const grid = { display: "flex", flexDirection: "column", gap: "12px" };
const card = {
  backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.md, padding: "16px",
  border: "1px solid rgba(255,255,255,0.1)",
};
const cardTop = { display: "flex", alignItems: "center", gap: "14px" };
const cardBottom = { display: "flex", justifyContent: "space-between", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.08)" };
const backBtn = { background: "none", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: "13px", fontWeight: "600", padding: 0, marginBottom: "16px" };
const detailCard = {
  backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.lg, padding: "24px",
  border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)",
};
const detailRow = { fontSize: "13px", color: "rgba(255,255,255,0.85)", lineHeight: "1.6", marginBottom: "10px" };
const divider = { height: "1px", backgroundColor: "rgba(255,255,255,0.08)", margin: "16px 0" };
const reqTag = {
  fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
  backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", fontWeight: "500",
};
const resumeLink = { color: "#93c5fd", fontSize: "13px", fontWeight: "600", textDecoration: "none" };
const infoMsg = { fontSize: "13px", fontWeight: "600", color: "#fbbf24" };
const viewBtn = {
  flex: 1, padding: "8px", fontSize: "12px", fontWeight: "700",
  background: "rgba(74,144,226,0.2)", color: "#93c5fd", border: "1px solid rgba(74,144,226,0.3)",
  borderRadius: "8px", cursor: "pointer",
};
const reapplyBtn = {
  flex: 1, padding: "8px", fontSize: "12px", fontWeight: "700",
  background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none",
  borderRadius: "8px", cursor: "pointer", boxShadow: "0 4px 16px rgba(26,115,232,0.3)",
};
const deleteBtn = {
  padding: "8px 12px", fontSize: "12px", fontWeight: "700",
  background: "rgba(239,68,68,0.2)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: "8px", cursor: "pointer",
};
const deleteConfirmBtn = {
  flex: 1, padding: "8px 14px", fontSize: "12px", fontWeight: "700",
  background: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer",
};
const cancelBtn = {
  padding: "8px 14px", fontSize: "12px", fontWeight: "600",
  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "8px", cursor: "pointer",
};
const hiredMsg = {
  marginTop: "10px", fontSize: "12px", color: "#86efac",
  fontWeight: "600", textAlign: "center",
};
