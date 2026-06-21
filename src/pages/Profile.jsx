import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { colors, radii, shadows } from "../uiStyles";

export default function Profile() {
  const { user, profile, loadProfile } = useAuth();
  const avatarInputRef = useRef(null);
  const resumeInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    location: "",
    skills: "",
    bio: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        location: profile.location || "",
        skills: profile.skills || "",
        bio: profile.bio || "",
      });
      if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file.");
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const filePath = `avatars/${user.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setMessage("Upload failed: " + uploadError.message);
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from("resumes")
        .getPublicUrl(filePath);

      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      setAvatarUrl(publicUrl);
      setMessage("Profile picture updated!");
      loadProfile(user.id);
    }
    setUploadingAvatar(false);
  }

  async function handleResumeUpload(e) {
    const file = e.target.files[0];
    if (!file || !user) return;

    setUploadingResume(true);
    const filePath = `resumes/${user.id}/${file.name}`;

    const { error } = await supabase.storage
      .from("resumes")
      .upload(filePath, file, { upsert: true });

    if (error) {
      setMessage("Upload failed: " + error.message);
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from("resumes")
        .getPublicUrl(filePath);

      await supabase.from("profiles").update({ resume_url: publicUrl }).eq("id", user.id);
      setMessage("Resume uploaded successfully!");
      loadProfile(user.id);
    }
    setUploadingResume(false);
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    if (error) {
      setMessage("Failed to save: " + error.message);
    } else {
      setMessage("Profile updated successfully!");
      loadProfile(user.id);
    }
    setSaving(false);
  }

  return (
    <div style={container}>
      <div style={headerTextWrapper}>
        <h2 style={mainTitle}>Profile Settings</h2>
        <p style={subTitle}>Manage your photo, resume, skills, and personal details.</p>
      </div>

      {message && (
        <p style={{
          padding: "10px",
          borderRadius: "8px",
          marginBottom: "20px",
          fontSize: "13px",
          fontWeight: "600",
          backgroundColor: message.includes("success") || message.includes("updated") ? "#e2f9eb" : "#fee2e2",
          color: message.includes("success") || message.includes("updated") ? colors.success : colors.danger,
          textAlign: "center",
          maxWidth: "600px",
          margin: "0 auto 20px",
        }}>
          {message}
        </p>
      )}

      <div style={profileLayoutGrid}>
        {/* Left Column */}
        <div style={sideColumn}>
          <div style={profileCard}>
            <div style={cardHeader}>
              <div style={smallIconBox}>📞</div>
              <h4 style={cardTitle}>Contact Information</h4>
            </div>
            <div style={fieldGroup}>
              <label style={label}>Full Name</label>
              <input className="input" value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Phone</label>
              <input className="input" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Location</label>
              <input className="input" value={form.location} placeholder="e.g., Toledo City, Cebu"
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSave}>
              {saving ? "Saving..." : "Save Details"}
            </button>
          </div>

          <div style={profileCard}>
            <div style={cardHeader}>
              <div style={smallIconBox}>⚙️</div>
              <h4 style={cardTitle}>Key Skills</h4>
            </div>
            <div style={fieldGroup}>
              <label style={label}>Skills (comma-separated)</label>
              <textarea className="input" style={{ minHeight: "80px", resize: "vertical" }}
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="e.g., Customer Service, Sales, Communication" />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSave}>
              {saving ? "Saving..." : "Save Skills"}
            </button>
          </div>

          <div style={profileCard}>
            <div style={cardHeader}>
              <div style={smallIconBox}>📝</div>
              <h4 style={cardTitle}>About Me</h4>
            </div>
            <div style={fieldGroup}>
              <label style={label}>Short bio / description</label>
              <textarea className="input" style={{ minHeight: "100px", resize: "vertical" }}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell employers about yourself, your experience, and what you're looking for..." />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSave}>
              {saving ? "Saving..." : "Save Bio"}
            </button>
          </div>
        </div>

        {/* Center Column */}
        <div style={centerSection}>
          <div style={photoWrapper} onClick={() => avatarInputRef.current.click()}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" style={avatarImage} />
            ) : (
              <div style={photoPlaceholder}>
                {profile?.full_name?.[0] || "👤"}
              </div>
            )}
            <div style={editPhotoBadge}>
              {uploadingAvatar ? "⏳" : "📷"}
            </div>
          </div>
          <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload}
            style={{ display: "none" }} accept="image/*" />

          <h3 style={profileName}>{profile?.full_name || "User"}</h3>
          <p style={profileEmail}>{user?.email}</p>

          <div style={{ width: "100%", marginTop: "20px" }}>
            <div style={profileCard}>
              <div style={cardHeader}>
                <div style={smallIconBox}>📄</div>
                <h4 style={cardTitle}>Resume</h4>
              </div>
              {profile?.resume_url ? (
                <>
                  <p style={cardDetail}>✅ Resume uploaded</p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <a href={profile.resume_url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-outline" style={{ fontSize: "13px", padding: "8px 16px" }}>
                      View Resume
                    </a>
                    <button className="btn btn-primary" style={{ fontSize: "13px", padding: "8px 16px" }}
                      onClick={() => resumeInputRef.current.click()}>
                      Update
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={cardDetail}>No resume uploaded yet</p>
                  <button className="btn btn-primary" style={{ fontSize: "13px", padding: "8px 16px" }}
                    onClick={() => resumeInputRef.current.click()}>
                    {uploadingResume ? "Uploading..." : "Upload Resume"}
                  </button>
                </>
              )}
              <input type="file" ref={resumeInputRef} onChange={handleResumeUpload}
                style={{ display: "none" }} accept=".pdf,.doc,.docx" />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={sideColumn}>
          <div style={profileCard}>
            <div style={cardHeader}>
              <div style={smallIconBox}>💼</div>
              <h4 style={cardTitle}>Account</h4>
            </div>
            <p style={cardDetail}><strong>Email:</strong> {user?.email}</p>
            <p style={cardDetail}><strong>Role:</strong> {profile?.role}</p>
            <p style={cardDetail}><strong>Status:</strong> {profile?.status}</p>
            <p style={cardDetail}><strong>Joined:</strong> {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const container = { padding: "10px", width: "100%" };
const headerTextWrapper = { textAlign: "center", marginBottom: "28px" };
const mainTitle = { fontSize: "26px", fontWeight: "800", color: colors.navy, marginBottom: "6px" };
const subTitle = { fontSize: "14px", color: colors.textSecondary };

const profileLayoutGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 0.8fr 1fr",
  gap: "20px",
  maxWidth: "1050px",
  margin: "0 auto",
  alignItems: "start",
};

const sideColumn = { display: "flex", flexDirection: "column", gap: "20px" };

const centerSection = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: "10px",
};

const photoWrapper = {
  width: "130px",
  height: "130px",
  borderRadius: "50%",
  backgroundColor: colors.bg,
  marginBottom: "12px",
  position: "relative",
  cursor: "pointer",
  overflow: "hidden",
  boxShadow: shadows.md,
  border: "3px solid #fff",
};

const photoPlaceholder = {
  fontSize: "50px",
  display: "flex",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "700",
  color: colors.primaryDark,
};

const avatarImage = { width: "100%", height: "100%", objectFit: "cover" };

const editPhotoBadge = {
  position: "absolute",
  bottom: "4px",
  right: "4px",
  backgroundColor: colors.primaryDark,
  borderRadius: "50%",
  padding: "6px",
  fontSize: "12px",
  color: "#fff",
  boxShadow: shadows.sm,
  lineHeight: "1",
};

const profileName = { fontSize: "18px", fontWeight: "800", color: colors.navy, margin: 0 };
const profileEmail = { fontSize: "13px", color: colors.textSecondary, marginBottom: "10px" };

const profileCard = {
  backgroundColor: colors.white,
  borderRadius: radii.xl,
  padding: "20px",
  boxShadow: shadows.sm,
  textAlign: "left",
};

const cardHeader = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" };
const smallIconBox = { backgroundColor: colors.bg, padding: "8px", borderRadius: radii.sm, fontSize: "16px" };
const cardTitle = { fontSize: "14px", fontWeight: "800", color: colors.navy, margin: 0 };
const cardDetail = { fontSize: "13px", color: colors.textSecondary, lineHeight: "1.6", marginBottom: "8px" };
const fieldGroup = { marginBottom: "12px" };
const label = { display: "block", fontSize: "12px", color: colors.textSecondary, marginBottom: "4px", fontWeight: "500" };
