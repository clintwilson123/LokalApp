import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../uiStyles";
import { SkeletonCard } from "../components/Skeleton";

export default function MyApplications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchApplications();
  }, [user]);

  async function fetchApplications() {
    const { data } = await supabase
      .from("applications")
      .select("id, job_id, status, score, created_at, jobs(title, company, location, icon)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setApplications(data);
    setLoading(false);
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
      interviewed: { bg: "rgba(139,92,246,0.2)", color: "#c4b5fd" },
      rejected: { bg: "rgba(248,113,113,0.2)", color: "#fca5a5" },
      hired: { bg: "rgba(34,197,94,0.2)", color: "#86efac" },
    };
    const s = map[status] || map.pending;
    return {
      fontSize: "11px", padding: "3px 10px", borderRadius: "20px",
      fontWeight: "600", backgroundColor: s.bg, color: s.color, textTransform: "capitalize",
    };
  };

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
              {app.status === "rejected" && (
                <button
                  onClick={() => handleReapply(app)}
                  style={{
                    marginTop: "10px", width: "100%", padding: "8px", fontSize: "12px", fontWeight: "700",
                    background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none",
                    borderRadius: "8px", cursor: "pointer", boxShadow: "0 4px 16px rgba(26,115,232,0.3)",
                  }}
                >
                  🔄 Apply Again
                </button>
              )}
              {app.status === "hired" && (
                <div style={{
                  marginTop: "10px", fontSize: "12px", color: "#86efac",
                  fontWeight: "600", textAlign: "center",
                }}>
                  ✅ You're hired for this position!
                </div>
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
