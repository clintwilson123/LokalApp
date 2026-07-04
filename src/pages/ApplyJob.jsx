import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { colors } from "../uiStyles";
import { SkeletonLine, SkeletonCard } from "../components/Skeleton";

export default function ApplyJob() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user, profile, loadProfile } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState("");

  const fetchJob = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    setJob(data);
    setLoading(false);
  };

  const checkIfApplied = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("applications")
      .select("id")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .maybeSingle();
    if (data) setApplied(true);
  };

  useEffect(() => {
    fetchJob();
    checkIfApplied();
  }, [jobId]);

  async function handleApply() {
    setApplying(true);
    setMessage("");

    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      job_id: parseInt(jobId),
      status: "pending",
    });

    if (error) {
      setMessage("Failed to apply. Please try again.");
      setApplying(false);
      return;
    }

    setApplied(true);
    await loadProfile(user.id);

    await supabase.from("notifications").insert({
      user_id: user.id,
      message: `Your application for ${job.title} has been submitted.`,
      type: "success",
    });

    setTimeout(() => navigate("/my-applications"), 1500);
  }

  const profileComplete = profile?.full_name?.trim() && profile?.location?.trim() && profile?.skills?.trim();

  if (loading) {
    return (
      <div style={{ padding: "5px" }}>
        <SkeletonLine width="40px" height="40px" />
        <div style={{ height: "16px" }} />
        <SkeletonLine width="70%" height="28px" />
        <div style={{ height: "24px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px" }}>
          <SkeletonCard lines={5} />
          <SkeletonCard lines={3} />
        </div>
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
    <div style={{ height: "100%", overflowY: "auto", textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <button onClick={() => navigate(-1)} style={backBtn}>←</button>
      </div>

      {message && (
        <p style={{
          padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px", fontWeight: "600",
          backgroundColor: applied ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          color: applied ? colors.success : colors.danger,
        }}>
          {message}
        </p>
      )}

      {applied ? (
        <div style={{ textAlign: "center", padding: "60px 40px" }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ marginBottom: "12px" }}>
            <circle cx="28" cy="28" r="26" fill="none" stroke="#4a90e2" strokeWidth="3"
              style={{ strokeDasharray: 163, strokeDashoffset: 0, transition: "stroke-dashoffset 0.6s ease" }} />
            <polyline points="18,28 25,35 38,21" fill="none" stroke="#4a90e2" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 30, strokeDashoffset: 0, transition: "stroke-dashoffset 0.4s ease 0.3s" }} />
          </svg>
          <h3 style={{ color: "#fff", margin: "0 0 8px", fontSize: "20px", fontWeight: "700" }}>Application Submitted!</h3>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>Redirecting to your applications...</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "26px", color: "#fff", fontWeight: "800", margin: 0 }}>{job.title}</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", margin: "6px 0", fontSize: "14px" }}>
              📍 {job.company} • {job.location}
            </p>
            <p style={{ fontWeight: "700", color: "#93c5fd", fontSize: "16px" }}>{job.salary}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={infoCard}>
                <h4 style={{ color: "#fff", fontSize: "15px", fontWeight: "700", marginBottom: "10px" }}>Job Description</h4>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", lineHeight: "1.6" }}>{job.description || "No description provided."}</p>
              </div>
              <div style={infoCard}>
                <h4 style={{ color: "#fff", fontSize: "15px", fontWeight: "700", marginBottom: "10px" }}>Requirements</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {job.requirements?.map((req, index) => (
                    <div key={index} style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>✅ {req}</div>
                  )) || <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>No requirements listed.</p>}
                </div>
              </div>
            </div>

            <div>
              <div style={summaryCard}>
                <h4 style={{ color: "#fff", fontSize: "15px", fontWeight: "700", marginBottom: "14px" }}>
                  Your Profile
                </h4>

                <div style={summaryRow}>
                  <span style={summaryLabel}>Name</span>
                  <span style={summaryValue}>{profile?.full_name || "Not set"}</span>
                </div>
                <div style={summaryRow}>
                  <span style={summaryLabel}>Phone</span>
                  <span style={summaryValue}>{profile?.phone_number || "Not set"}</span>
                </div>
                <div style={summaryRow}>
                  <span style={summaryLabel}>Location</span>
                  <span style={summaryValue}>{profile?.location || "Not set"}</span>
                </div>
                <div style={summaryRow}>
                  <span style={summaryLabel}>Skills</span>
                  <span style={summaryValue}>{profile?.skills || "Not set"}</span>
                </div>
                <div style={summaryRow}>
                  <span style={summaryLabel}>Resume</span>
                  <span style={summaryValue}>
                    {profile?.resume_url ? (
                      <a href={profile.resume_url} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>View ↗</a>
                    ) : "Not set"}
                  </span>
                </div>

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "14px", paddingTop: "14px" }}>
                  {profileComplete ? (
                    <button
                      style={{ width: "100%", padding: "12px", fontSize: "14px", background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 16px rgba(26,115,232,0.3)" }}
                      onClick={handleApply}
                      disabled={applying}
                    >
                      {applying ? "Submitting..." : "Apply Now"}
                    </button>
                  ) : (
                    <>
                      <p style={{ fontSize: "12px", color: colors.danger, marginBottom: "10px", textAlign: "center" }}>
                        Complete your profile before applying.
                      </p>
                      <button
                        style={{ width: "100%", padding: "10px", fontSize: "13px", background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}
                        onClick={() => navigate("/profile")}
                      >
                        Go to Profile
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const backBtn = { width: "40px", height: "40px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.06)", cursor: "pointer", fontSize: "18px", backdropFilter: "blur(8px)", color: "#fff" };
const infoCard = { backgroundColor: "rgba(255,255,255,0.06)", padding: "20px", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" };
const summaryCard = { backgroundColor: "rgba(255,255,255,0.06)", padding: "20px", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" };
const summaryRow = { display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "13px" };
const summaryLabel = { color: "rgba(255,255,255,0.5)" };
const summaryValue = { color: "rgba(255,255,255,0.85)", fontWeight: "500", textAlign: "right", maxWidth: "60%" };
