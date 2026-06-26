import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { colors, radii, shadows } from "../uiStyles";
import { SkeletonCard } from "../components/Skeleton";

export default function Reports() {
  const [stats, setStats] = useState({ jobs: 0, apps: 0, applicants: 0, interviews: 0 });
  const [recentApps, setRecentApps] = useState([]);
  const [appsByJob, setAppsByJob] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [{ count: jobs }, { count: apps }, { count: applicants }, { count: interviews }] =
      await Promise.all([
        supabase.from("jobs").select("*", { count: "exact", head: true }),
        supabase.from("applications").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "applicant"),
        supabase.from("interviews").select("*", { count: "exact", head: true }),
      ]);

    setStats({
      jobs: jobs || 0,
      apps: apps || 0,
      applicants: applicants || 0,
      interviews: interviews || 0,
    });

    // Recent 10 applications with user & job details
    const { data: appData } = await supabase
      .from("applications")
      .select("id, status, score, created_at, user_id, job_id, profiles(full_name), jobs(title)")
      .order("created_at", { ascending: false })
      .limit(10);
    if (appData) setRecentApps(appData);

    // Applications grouped by job
    const { data: jobsData } = await supabase.from("jobs").select("id, title, icon");
    if (jobsData) {
      const withCounts = await Promise.all(
        jobsData.map(async (job) => {
          const { count } = await supabase
            .from("applications")
            .select("*", { count: "exact", head: true })
            .eq("job_id", job.id);
          return { ...job, count: count || 0 };
        })
      );
      setAppsByJob(withCounts.sort((a, b) => b.count - a.count));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const getStatusColor = (s) => {
    if (s === "accepted") return colors.success;
    if (s === "rejected") return colors.danger;
    return colors.warning;
  };

  if (loading) {
    return (
      <div style={{ padding: "5px" }}>
        <div style={{ display: "flex", gap: "12px", margin: "20px 0", flexWrap: "wrap" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ flex: "1 1 120px" }}><SkeletonCard lines={1} /></div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", color: colors.navy, fontWeight: "800", margin: "0 0 4px" }}>Platform Reports</h2>
        <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0 }}>Real-time statistics and activity overview</p>
      </div>

      <div style={summaryRow}>
        <div style={summaryCard}>
          <span style={{ fontSize: "22px" }}>💼</span>
          <div><h4 style={summaryNum}>{stats.jobs}</h4><p style={summaryLabel}>Total Jobs</p></div>
        </div>
        <div style={summaryCard}>
          <span style={{ fontSize: "22px" }}>📋</span>
          <div><h4 style={summaryNum}>{stats.apps}</h4><p style={summaryLabel}>Applications</p></div>
        </div>
        <div style={summaryCard}>
          <span style={{ fontSize: "22px" }}>👤</span>
          <div><h4 style={summaryNum}>{stats.applicants}</h4><p style={summaryLabel}>Applicants</p></div>
        </div>
        <div style={summaryCard}>
          <span style={{ fontSize: "22px" }}>📅</span>
          <div><h4 style={summaryNum}>{stats.interviews}</h4><p style={summaryLabel}>Interviews</p></div>
        </div>
      </div>

      <div style={dualGrid}>
        <div style={sectionCard}>
          <h4 style={sectionTitle}>Applications by Job</h4>
          {appsByJob.length === 0 ? (
            <p style={{ color: colors.textSecondary, fontSize: "13px" }}>No applications yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {appsByJob.map((job) => {
                const maxCount = Math.max(...appsByJob.map((j) => j.count), 1);
                const pct = Math.round((job.count / maxCount) * 100);
                return (
                  <div key={job.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span style={{ color: colors.navy, fontWeight: "600" }}>{job.icon} {job.title}</span>
                      <span style={{ color: colors.textSecondary }}>{job.count}</span>
                    </div>
                    <div style={barBg}>
                      <div style={{ ...barFill, width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={sectionCard}>
          <h4 style={sectionTitle}>Recent Applications</h4>
          {recentApps.length === 0 ? (
            <p style={{ color: colors.textSecondary, fontSize: "13px" }}>No applications yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recentApps.map((app) => (
                <div key={app.id} style={appRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: colors.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {app.profiles?.full_name || "Unknown"}
                    </div>
                    <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                      {app.jobs?.title || "Unknown job"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", backgroundColor: getStatusColor(app.status), color: "#fff", fontWeight: "600" }}>
                      {app.status}
                    </span>
                    <div style={{ fontSize: "10px", color: colors.textSecondary, marginTop: "2px" }}>
                      {app.score}% match
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const container = { padding: "5px" };
const summaryRow = { display: "flex", gap: "12px", margin: "20px 0", flexWrap: "wrap" };
const summaryCard = {
  flex: "1 1 120px", backgroundColor: colors.white, padding: "14px", borderRadius: radii.sm,
  display: "flex", alignItems: "center", gap: "12px", boxShadow: shadows.sm,
};
const summaryNum = { margin: 0, fontSize: "18px", color: colors.navy };
const summaryLabel = { margin: 0, fontSize: "11px", color: colors.textSecondary };
const dualGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" };
const sectionCard = {
  backgroundColor: "rgba(255,255,255,0.7)", borderRadius: radii.lg, padding: "20px", boxShadow: shadows.sm,
};
const sectionTitle = { fontSize: "14px", fontWeight: "700", color: colors.navy, margin: "0 0 16px" };
const barBg = { height: "8px", backgroundColor: colors.bg, borderRadius: "10px", overflow: "hidden" };
const barFill = { height: "100%", backgroundColor: colors.primary, borderRadius: "10px", transition: "width 0.5s ease" };
const appRow = {
  display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px",
  borderRadius: "10px", backgroundColor: colors.white,
};
