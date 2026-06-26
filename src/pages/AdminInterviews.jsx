import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { colors, radii, shadows } from "../uiStyles";
import { SkeletonTable } from "../components/Skeleton";

export default function AdminInterviews() {
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [showForm, setShowForm] = useState(null);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({ date: "", time: "", location: "CJTECH Computer Trading", instructions: "Please arrive 10 minutes early." });

  const fetchAll = async () => {
    const [j, i] = await Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("interviews").select("*, applications(id, user_id, job_id, profiles(full_name), jobs(title))").order("date", { ascending: true }),
    ]);
    if (j.data) setJobs(j.data);
    if (i.data) setInterviews(i.data);
    setLoading(false);
  };

  const fetchApplicants = async (jobId) => {
    const { data } = await supabase
      .from("applications")
      .select("id, user_id, status, score, created_at, profiles(full_name, skills, phone_number)")
      .eq("job_id", jobId);
    if (data) setApplicants(data);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setShowForm(null);
    setMessage("");
    fetchApplicants(job.id);
  };

  const handleSchedule = async (application) => {
    setScheduling(true);
    setMessage("");

    const { error } = await supabase.from("interviews").insert({
      application_id: application.id,
      date: form.date,
      time: form.time,
      location: form.location,
      instructions: form.instructions,
    });

    if (error) {
      setMessage("Failed to schedule: " + error.message);
    } else {
      setMessage(`Interview scheduled for ${application.profiles?.full_name || "applicant"}!`);
      await supabase.from("notifications").insert({
        user_id: application.user_id,
        message: `You have an interview for ${selectedJob.title} on ${form.date} at ${form.time}.`,
        type: "interview",
      });
      setShowForm(null);
      setForm({ date: "", time: "", location: "CJTECH Computer Trading", instructions: "Please arrive 10 minutes early." });
      fetchAll();
      if (selectedJob) fetchApplicants(selectedJob.id);
    }
    setScheduling(false);
  };

  if (loading) {
    return <div style={{ padding: "5px" }}><SkeletonTable rows={4} cols={5} /></div>;
  }

  const hasInterview = (applicationId) => interviews.some((i) => i.application_id === applicationId);

  if (selectedJob) {
    return (
      <div style={{ textAlign: "left" }}>
        <button onClick={() => { setSelectedJob(null); setShowForm(null); setMessage(""); }} style={backBtn}>← Back to Jobs</button>
        <h3 style={{ color: colors.navy, marginBottom: "4px" }}>{selectedJob.icon} {selectedJob.title}</h3>
        <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "16px" }}>{selectedJob.company} • {applicants.length} applicant{applicants.length !== 1 ? "s" : ""}</p>

        {message && (
          <p style={{
            padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "600",
            backgroundColor: message.includes("Failed") ? "#fee2e2" : "#e2f9eb",
            color: message.includes("Failed") ? colors.danger : colors.success,
          }}>{message}</p>
        )}

        {applicants.length === 0 ? (
          <p style={{ color: colors.textSecondary, fontSize: "14px", padding: "20px 0" }}>No applications for this job yet.</p>
        ) : (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                  <th style={thStyle}>Applicant</th>
                  <th style={thStyle}>Skills</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((app) => (
                  <tr key={app.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: "600", color: colors.navy, fontSize: "13px" }}>{app.profiles?.full_name || "Unknown"}</div>
                    </td>
                    <td style={{ ...tdStyle, fontSize: "12px", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {app.profiles?.skills || "—"}
                    </td>
                    <td style={tdStyle}>{app.score ?? "—"}%</td>
                    <td style={tdStyle}><span style={statusBadge(app.status)}>{app.status}</span></td>
                    <td style={tdStyle}>
                      {hasInterview(app.id) ? (
                        <span style={{ fontSize: "12px", color: colors.success, fontWeight: "600" }}>✅ Scheduled</span>
                      ) : showForm === app.id ? (
                        <div style={miniForm}>
                          <input type="date" style={miniInput} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                          <input type="time" style={miniInput} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                          <button style={{ ...miniBtn, backgroundColor: colors.success, color: "#fff" }} onClick={() => handleSchedule(app)} disabled={scheduling}>
                            {scheduling ? "..." : "Confirm"}
                          </button>
                          <button style={{ ...miniBtn, backgroundColor: colors.bg, color: colors.textSecondary }} onClick={() => setShowForm(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button style={scheduleBtn} onClick={() => { setShowForm(app.id); setForm({ ...form, date: "", time: "" }); }}>
                          Schedule Interview
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", color: colors.navy, fontWeight: "800", margin: "0 0 4px" }}>Interview Scheduling</h2>
        <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0 }}>Select a job to view applicants and schedule interviews</p>
      </div>

      <div style={statsRow}>
        <div style={statCard}>
          <span style={{ fontSize: "22px" }}>💼</span>
          <div><h4 style={statNum}>{jobs.length}</h4><p style={statLabel}>Jobs</p></div>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: "22px" }}>📅</span>
          <div><h4 style={statNum}>{interviews.length}</h4><p style={statLabel}>Scheduled</p></div>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: "22px" }}>✅</span>
          <div><h4 style={statNum}>{interviews.filter((i) => i.status === "completed").length}</h4><p style={statLabel}>Completed</p></div>
        </div>
      </div>

      <div style={grid2x2}>
        {jobs.map((job) => (
          <div key={job.id} style={fileBox} onClick={() => handleSelectJob(job)}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>{job.icon || "💼"}</div>
            <div style={{ fontWeight: "800", color: colors.navy, fontSize: "16px" }}>{job.title}</div>
            <div style={{ color: colors.primary, fontWeight: "600", marginTop: "6px", fontSize: "13px" }}>
              {interviews.filter((i) => i.applications?.job_id === job.id).length} scheduled
            </div>
          </div>
        ))}
      </div>

      {interviews.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <h4 style={{ color: colors.navy, fontSize: "15px", fontWeight: "700", marginBottom: "12px" }}>All Scheduled Interviews</h4>
          <div style={tableWrapper2}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                  <th style={thStyle}>Applicant</th>
                  <th style={thStyle}>Job</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((iv) => (
                  <tr key={iv.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ ...tdStyle, fontWeight: "600" }}>{iv.applications?.profiles?.full_name || "—"}</td>
                    <td style={tdStyle}>{iv.applications?.jobs?.title || "—"}</td>
                    <td style={tdStyle}>{iv.date ? new Date(iv.date).toLocaleDateString() : "—"}</td>
                    <td style={tdStyle}>{iv.time?.slice(0, 5) || "—"}</td>
                    <td style={tdStyle}><span style={statusBadge(iv.status)}>{iv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const backBtn = { background: "none", border: "none", color: colors.primaryDark, cursor: "pointer", fontSize: "14px", fontWeight: "600", padding: "8px 0", marginBottom: "12px" };
const statsRow = { display: "flex", gap: "12px", margin: "20px 0", flexWrap: "wrap" };
const statCard = { flex: "1 1 120px", backgroundColor: colors.white, padding: "14px", borderRadius: radii.sm, display: "flex", alignItems: "center", gap: "12px", boxShadow: shadows.sm };
const statNum = { margin: 0, fontSize: "18px", color: colors.navy };
const statLabel = { margin: 0, fontSize: "11px", color: colors.textSecondary };
const grid2x2 = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", width: "100%", maxWidth: "650px" };
const fileBox = { backgroundColor: colors.white, padding: "28px 16px", borderRadius: radii.xl, textAlign: "center", cursor: "pointer", border: `1px solid ${colors.border}`, transition: "transform 0.2s, box-shadow 0.2s" };
const tableWrapper = { backgroundColor: "rgba(255,255,255,0.7)", borderRadius: radii.lg, padding: "16px", boxShadow: shadows.sm, overflowX: "auto" };
const tableWrapper2 = { backgroundColor: "rgba(255,255,255,0.7)", borderRadius: radii.lg, padding: "16px", boxShadow: shadows.sm, overflowX: "auto" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "600px" };
const thStyle = { padding: "10px", color: colors.textSecondary, fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap" };
const tdStyle = { padding: "10px", fontSize: "13px", color: colors.navy };
const miniForm = { display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" };
const miniInput = { padding: "6px 8px", borderRadius: "6px", border: `1px solid ${colors.border}`, fontSize: "12px", outline: "none", width: "120px" };
const miniBtn = { padding: "6px 10px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "11px" };
const scheduleBtn = { padding: "6px 12px", fontSize: "11px", border: "none", borderRadius: "6px", backgroundColor: colors.primaryLight, color: colors.primaryDark, cursor: "pointer", fontWeight: "600", whiteSpace: "nowrap" };

const statusBadge = (val) => {
  const map = { scheduled: "#d97706", completed: "#22c55e", cancelled: "#f87171", pending: "#64748b" };
  return { fontSize: "11px", padding: "2px 8px", borderRadius: "10px", backgroundColor: (map[val] || "#64748b") + "20", color: map[val] || "#64748b", fontWeight: "600", textTransform: "capitalize" };
};
