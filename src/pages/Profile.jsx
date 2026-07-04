import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../uiStyles";

export default function Profile() {
  const { user, profile, loadProfile } = useAuth();
  const avatarInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    location: "",
    skills: "",
    bio: "",
  });
  const [resumeLink, setResumeLink] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        phone_number: profile.phone_number || "",
        location: profile.location || "",
        skills: profile.skills || "",
        bio: profile.bio || "",
      });
      setResumeLink(profile.resume_url || "");
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

      const cacheBusted = publicUrl + "?t=" + Date.now();
      await supabase.rpc("update_my_profile", {
        p_data: { avatar_url: cacheBusted },
      });
      setAvatarUrl(cacheBusted);
      setMessage("Profile picture updated!");
      loadProfile(user.id);
    }
    setUploadingAvatar(false);
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("update_my_profile", {
      p_data: {
        full_name: form.full_name,
        phone_number: form.phone_number,
        location: form.location,
        skills: form.skills,
        bio: form.bio,
        resume_url: resumeLink.trim(),
      },
    });

    if (error) {
      setMessage("Failed to save: " + error.message);
    } else {
      setMessage("Profile saved successfully!");
      loadProfile(user.id);
    }
    setSaving(false);
  }

  const msgBg = message.includes("success") || message.includes("saved") || message.includes("updated")
    ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  const msgColor = message.includes("success") || message.includes("saved") || message.includes("updated")
    ? colors.success : colors.danger;

  return (
    <div style={container}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", color: "#fff", fontWeight: "800", margin: "0 0 4px" }}>My Profile</h2>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
          Manage your personal details, skills, and resume
        </p>
      </div>

      {message && (
        <p style={{
          padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "600",
          backgroundColor: msgBg, color: msgColor, textAlign: "center",
        }}>
          {message}
        </p>
      )}

      <div style={layout}>
        <div style={leftCol}>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
              <div style={photoWrapper} onClick={() => avatarInputRef.current.click()}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" style={avatarImage} />
                ) : (
                  <div style={photoPlaceholder}>
                    {profile?.full_name?.[0] || "👤"}
                  </div>
                )}
                <div style={editBadge}>{uploadingAvatar ? "⏳" : "📷"}</div>
              </div>
              <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload}
                style={{ display: "none" }} accept="image/*" />
              <div>
                <h3 style={{ margin: 0, color: "#fff", fontSize: "16px" }}>
                  {profile?.full_name || "User"}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                  {user?.email}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                  Status: <strong style={{ color: "#93c5fd" }}>{profile?.status}</strong>
                </p>
              </div>
            </div>
          </div>

          <div style={card}>
            <h4 style={sectionTitle}>Contact Information</h4>
            <div style={fieldGroup}>
              <label style={label}>Full Name</label>
              <input style={input} value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Email</label>
              <input style={{ ...input, opacity: 0.5 }} value={user?.email || ""} disabled />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Phone</label>
              <input style={input} value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Location</label>
              <input style={input} value={form.location} placeholder="e.g., Toledo City, Cebu"
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
        </div>

        <div style={rightCol}>
          <div style={card}>
            <h4 style={sectionTitle}>Skills & Resume</h4>
            <div style={fieldGroup}>
              <label style={label}>Skills (comma-separated)</label>
              <textarea style={{ ...input, minHeight: "60px", resize: "vertical" }}
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="e.g., Customer Service, Sales, Communication" />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Resume (Google Drive link)</label>
              <input style={input} type="url" value={resumeLink}
                onChange={(e) => setResumeLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/..." />
            </div>
          </div>

          <div style={card}>
            <h4 style={sectionTitle}>About Me</h4>
            <textarea style={{ ...input, minHeight: "80px", resize: "vertical" }}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Tell employers about yourself..." />
          </div>

          <button style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "700", fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 16px rgba(26,115,232,0.3)" }}
            onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

const container = { padding: "5px" };
const layout = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" };
const leftCol = { display: "flex", flexDirection: "column", gap: "16px" };
const rightCol = { display: "flex", flexDirection: "column", gap: "16px" };
const card = {
  backgroundColor: "rgba(255,255,255,0.06)", padding: "20px", borderRadius: radii.lg,
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(12px)",
};
const sectionTitle = { margin: "0 0 14px", color: "#fff", fontSize: "14px", fontWeight: "700" };
const fieldGroup = { marginBottom: "12px" };
const label = { display: "block", fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "4px", fontWeight: "500" };
const input = {
  width: "100%", padding: "12px 16px", borderRadius: radii.sm,
  border: "1px solid rgba(255,255,255,0.15)",
  backgroundColor: "rgba(255,255,255,0.06)", color: "#fff",
  fontSize: "14px", outline: "none", boxSizing: "border-box",
  fontFamily: "'Inter', sans-serif",
};

const photoWrapper = {
  width: "72px", height: "72px", borderRadius: "50%",
  backgroundColor: "rgba(255,255,255,0.06)", position: "relative", cursor: "pointer",
  overflow: "hidden", flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)",
};
const photoPlaceholder = {
  fontSize: "28px", display: "flex", height: "100%",
  alignItems: "center", justifyContent: "center", fontWeight: "700", color: "#93c5fd",
};
const avatarImage = { width: "100%", height: "100%", objectFit: "cover" };
const editBadge = {
  position: "absolute", bottom: 0, right: 0,
  background: "linear-gradient(135deg, #4a90e2, #1a73e8)", borderRadius: "50%",
  padding: "3px", fontSize: "10px", color: "#fff", lineHeight: "1",
};
