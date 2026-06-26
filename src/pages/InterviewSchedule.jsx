import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { colors, radii, shadows } from "../uiStyles";
import { SkeletonLine } from "../components/Skeleton";

export default function InterviewSchedule() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInterviews = async () => {
    const { data } = await supabase
      .from("interviews")
      .select("*, applications!inner(job_id, user_id, jobs!inner(title))")
      .eq("applications.user_id", user.id)
      .order("date", { ascending: true });
    if (data) setInterviews(data);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchInterviews();
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center", padding: "20px" }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} style={{ width: "100%", maxWidth: "550px", borderRadius: radii.xxl, overflow: "hidden" }}>
            <div style={{ padding: "28px 32px", background: colors.navy }}>
              <SkeletonLine width="60%" height="18px" />
              <div style={{ height: "12px" }} />
              <SkeletonLine width="40%" height="14px" />
              <div style={{ height: "8px" }} />
              <SkeletonLine width="45%" height="14px" />
            </div>
            <div style={{ padding: "24px 32px", backgroundColor: "rgba(255,255,255,0.85)" }}>
              <SkeletonLine width="70%" height="14px" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (interviews.length === 0) {
    return (
      <div style={container}>
        <h2 style={headerTitle}>INTERVIEW SCHEDULE</h2>
        <div style={{ textAlign: "center", padding: "40px", color: colors.textSecondary }}>
          <p style={{ fontSize: "40px", marginBottom: "12px" }}>📅</p>
          <p>No interviews scheduled yet.</p>
          <p style={{ fontSize: "13px", marginTop: "8px" }}>Apply to jobs to get interview invitations.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <h2 style={headerTitle}>INTERVIEW SCHEDULE</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
        {interviews.map((interview) => (
          <div key={interview.id} style={fullCard}>
            <div style={blueTopSection}>
              <div style={cardHeader}>
                <span style={headerIcon}>🗓️</span>
                <h4 style={interviewTitle}>
                  {interview.applications?.jobs?.title || "Interview"}
                </h4>
              </div>
              <div style={detailRow}>
                <span>📅</span>
                <p style={detailText}>
                  {new Date(interview.date).toLocaleDateString()} | {interview.time?.slice(0, 5)}
                </p>
              </div>
              <div style={detailRow}>
                <span>📍</span>
                <p style={detailText}>{interview.location || "CJTECH Computer Trading"}</p>
              </div>
            </div>
            <div style={whiteBottomSection}>
              <div style={instructionRow}>
                <span>🕒</span>
                <p style={instructionText}>{interview.instructions || "Please arrive 10 minutes early."}</p>
              </div>
              <span className={`badge ${interview.status === "scheduled" ? "badge-warning" : "badge-success"}`}>
                {interview.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const container = { padding: "10px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" };
const headerTitle = { color: colors.navy, fontSize: "22px", fontWeight: "800", marginBottom: "28px", letterSpacing: "1px" };
const fullCard = {
  width: "100%",
  maxWidth: "550px",
  borderRadius: radii.xxl,
  overflow: "hidden",
  boxShadow: shadows.xl,
};
const blueTopSection = {
  background: "linear-gradient(180deg, #5b92ad 0%, #4a7c96 100%)",
  padding: "28px 32px",
  color: "white",
  textAlign: "left",
};
const cardHeader = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" };
const headerIcon = { fontSize: "20px" };
const interviewTitle = { margin: 0, fontSize: "18px", fontWeight: "700" };
const detailRow = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", fontSize: "14px" };
const detailText = { margin: 0, fontSize: "14px", fontWeight: "500", opacity: 0.95 };
const whiteBottomSection = {
  backgroundColor: "rgba(255, 255, 255, 0.85)",
  padding: "24px 32px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "14px",
};
const instructionRow = { display: "flex", alignItems: "center", gap: "10px", width: "100%", paddingBottom: "12px", borderBottom: "1px solid rgba(0,0,0,0.05)" };
const instructionText = { margin: 0, color: colors.navy, fontSize: "13px", fontWeight: "500", textAlign: "left" };
