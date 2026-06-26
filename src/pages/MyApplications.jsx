import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { colors, radii, shadows } from "../uiStyles";
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
    await supabase
      .from("applications")
      .update({ status: "pending" })
      .eq("id", application.id);
    await supabase.from("notifications").insert({
      user_id: user.id,
      message: `You re-applied for ${application.jobs?.title}. The admin will review your application.`,
      type: "info",
    });
    fetchApplications();
  }

  const statusBadge = (status) => {
    const map = {
      pending: { bg: "#d9770620", color: "#d97706" },
      reviewed: { bg: "#1a73e820", color: "#1a73e8" },
      interviewed: { bg: "#8b5cf620", color: "#8b5cf6" },
      rejected: { bg: "#f8717120", color: "#f87171" },
      hired: { bg: "#22c55e20", color: "#22c55e" },
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
      <h2 style={{ fontSize: "20px", color: colors.navy, fontWeight: "800", margin: "0 0 4px" }}>My Applications</h2>
      <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 20px" }}>
        {applications.length} application{applications.length !== 1 ? "s" : ""} submitted
      </p>

      {applications.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: colors.textSecondary }}>
          <span style={{ fontSize: "48px", display: "block", marginBottom: "12px", opacity: 0.4 }}>📋</span>
          <p style={{ fontWeight: "500" }}>You haven't applied to any jobs yet.</p>
          <p style={{ fontSize: "13px" }}>Browse jobs and submit your first application!</p>
        </div>
      ) : (
        <div className="stagger-children" style={grid}>
          {applications.map((app) => (
            <div key={app.id} style={card}>
              <div style={cardTop}>
                <span style={{ fontSize: "28px" }}>{app.jobs?.icon || "💼"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, color: colors.navy, fontSize: "15px" }}>{app.jobs?.title}</h4>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: colors.textSecondary }}>
                    {app.jobs?.company} • {app.jobs?.location}
                  </p>
                </div>
                <span style={statusBadge(app.status)}>{app.status}</span>
              </div>
              <div style={cardBottom}>
                <span style={{ fontSize: "12px", color: colors.textSecondary }}>
                  Applied: {new Date(app.created_at).toLocaleDateString()}
                </span>
                {app.score && (
                  <span style={{
                    fontSize: "12px", fontWeight: "700", color: colors.primaryDark,
                    background: colors.primaryLight, padding: "2px 8px", borderRadius: "12px",
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
                    backgroundColor: colors.primaryDark, color: "#fff", border: "none",
                    borderRadius: "8px", cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  🔄 Apply Again
                </button>
              )}
              {app.status === "hired" && (
                <div style={{
                  marginTop: "10px", fontSize: "12px", color: "#22c55e",
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
  backgroundColor: "rgba(255,255,255,0.8)", borderRadius: radii.md, padding: "16px",
  boxShadow: shadows.sm, border: "1px solid rgba(255,255,255,0.5)",
  backdropFilter: "blur(12px)", transition: "background 0.2s, transform 0.2s, box-shadow 0.2s",
};
const cardTop = { display: "flex", alignItems: "center", gap: "14px" };
const cardBottom = { display: "flex", justifyContent: "space-between", marginTop: "12px", paddingTop: "10px", borderTop: `1px solid ${colors.border}` };
