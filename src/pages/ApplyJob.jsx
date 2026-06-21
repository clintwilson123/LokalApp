import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../uiStyles";

export default function ApplyJob() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user, profile } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchJob();
    checkIfApplied();
  }, [jobId]);

  async function fetchJob() {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    setJob(data);
    setLoading(false);
  }

  async function checkIfApplied() {
    if (!user) return;
    const { data } = await supabase
      .from("applications")
      .select("id")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .maybeSingle();
    if (data) setApplied(true);
  }

  async function handleApply() {
    setApplying(true);
    setMessage("");

    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      job_id: parseInt(jobId),
      status: "pending",
      score: Math.floor(Math.random() * 30) + 70,
    });

    if (error) {
      setMessage("Failed to apply. Please try again.");
    } else {
      setApplied(true);
      setMessage("Application submitted successfully!");

      await supabase.from("notifications").insert({
        user_id: user.id,
        message: `Your application for ${job.title} has been submitted.`,
        type: "success",
      });
    }
    setApplying(false);
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: colors.textSecondary }}>
        Loading job details...
      </div>
    );
  }

  if (!job) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: colors.danger }}>
        Job not found.
      </div>
    );
  }

  return (
    <div style={scrollContainer}>
      <div style={headerActions}>
        <button onClick={() => navigate(-1)} style={backBtn}>←</button>
        <div style={buttonGroup}>
          {applied ? (
            <button style={{ ...applyBtn, backgroundColor: colors.success }} disabled>
              ✅ Applied
            </button>
          ) : (
            <button
              style={{ ...applyBtn, opacity: applying ? 0.7 : 1 }}
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? "Submitting..." : "Apply Now"}
            </button>
          )}
        </div>
      </div>

      {message && (
        <p style={{
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "16px",
          fontSize: "14px",
          fontWeight: "600",
          backgroundColor: applied ? "#e2f9eb" : "#fee2e2",
          color: applied ? colors.success : colors.danger,
        }}>
          {message}
        </p>
      )}

      <div style={titleSection}>
        <h2 style={jobTitle}>{job.title}</h2>
        <p style={subText}>📍 {job.company} • {job.location}</p>
        <p style={salaryText}>{job.salary}</p>
      </div>

      <div style={contentGrid}>
        <div style={leftCol}>
          <div style={infoCard}>
            <h4 style={cardTitle}>Job Description</h4>
            <p style={cardBody}>{job.description || "No description provided."}</p>
          </div>
          <div style={infoCard}>
            <h4 style={cardTitle}>Requirements</h4>
            <div style={reqGrid}>
              {job.requirements?.map((req, index) => (
                <div key={index} style={reqItem}>✅ {req}</div>
              )) || <p style={cardBody}>No requirements listed.</p>}
            </div>
          </div>
        </div>

        <div style={rightCol}>
          <div style={aiCard}>
            <h4 style={cardTitle}>Your Profile</h4>
            <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "8px" }}>
              {profile?.full_name || "Applicant"}
            </p>
            <p style={{ fontSize: "12px", color: colors.textSecondary }}>
              {profile?.resume_url
                ? "✅ Resume uploaded"
                : "⚠️ No resume uploaded"}
            </p>
            {!profile?.resume_url && (
              <button
                style={{ ...applyBtn, fontSize: "12px", padding: "8px 16px", marginTop: "10px" }}
                onClick={() => navigate("/profile")}
              >
                Upload Resume
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const scrollContainer = { height: "100%", overflowY: "auto", textAlign: "left" };
const headerActions = { display: "flex", justifyContent: "space-between", marginBottom: "20px" };
const backBtn = { width: "40px", height: "40px", borderRadius: "50%", border: "1px solid #e2eaf4", backgroundColor: "#fff", cursor: "pointer", fontSize: "18px" };
const buttonGroup = { display: "flex", gap: "10px" };
const applyBtn = { backgroundColor: colors.primary, color: "#fff", border: "none", padding: "10px 24px", borderRadius: "10px", fontWeight: "700", cursor: "pointer", fontSize: "14px" };
const titleSection = { marginBottom: "24px" };
const jobTitle = { fontSize: "26px", color: colors.navy, fontWeight: "800", margin: 0 };
const subText = { color: colors.textSecondary, margin: "6px 0", fontSize: "14px" };
const salaryText = { fontWeight: "700", color: colors.navy, fontSize: "16px" };
const contentGrid = { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px" };
const leftCol = { display: "flex", flexDirection: "column", gap: "16px" };
const rightCol = { display: "flex", flexDirection: "column" };
const infoCard = { backgroundColor: "#fff", padding: "20px", borderRadius: "20px", border: "1px solid #eef2f6" };
const cardTitle = { color: colors.navy, fontSize: "15px", fontWeight: "700", marginBottom: "10px" };
const cardBody = { color: colors.textSecondary, fontSize: "14px", lineHeight: "1.6" };
const reqGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" };
const reqItem = { fontSize: "13px", color: colors.navy };
const aiCard = { backgroundColor: "rgba(255, 255, 255, 0.5)", padding: "20px", borderRadius: "20px", border: "1px solid #e2eaf4" };
