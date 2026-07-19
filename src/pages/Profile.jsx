import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../uiStyles";

export default function Profile() {
  const { user, profile, loadProfile } = useAuth();
  const avatarInputRef = useRef(null);
  const resumeInputRef = useRef(null);
  const skillDropdownRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    location: "",
    bio: "",
  });
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const skillSearchRef = useRef(null);
  const skillTriggerRef = useRef(null);
  const [resumeLink, setResumeLink] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        phone_number: profile.phone_number || "",
        location: profile.location || "",
        bio: profile.bio || "",
      });
      setSelectedSkills(
        (profile.skills || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
      setResumeLink(profile.resume_url || "");
      if (profile.resume_url) {
        setResumeFileName(profile.resume_url.split("/").pop() || "");
      }
      if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  useEffect(() => {
    supabase
      .from("jobs")
      .select("requirements")
      .then(({ data }) => {
        const all = new Set();
        if (data) {
          data.forEach((job) => {
            (job.requirements || []).forEach((r) => all.add(r));
          });
        }
        setAvailableSkills([...all].sort());
      });
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (skillDropdownRef.current && !skillDropdownRef.current.contains(e.target)) {
        setShowSkillDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleSkill(skill) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  function removeSkill(skill) {
    setSelectedSkills((prev) => prev.filter((s) => s !== skill));
  }

  function clearAllSkills() {
    setSelectedSkills([]);
  }

  const filteredSkills = availableSkills.filter(
    (s) => s.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  async function handleResumeUpload(e) {
    const file = e.target.files[0];
    if (!file || !user) return;

    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setMessage("Please select a PDF or DOC/DOCX file.");
      return;
    }

    setUploadingResume(true);
    const ext = file.name.split(".").pop();
    const filePath = `resumes/${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setMessage("Upload failed: " + uploadError.message);
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from("resumes")
        .getPublicUrl(filePath);

      setResumeLink(publicUrl);
      setResumeFileName(file.name);
      setMessage("Resume uploaded successfully! Don't forget to save.");
    }
    setUploadingResume(false);
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("update_my_profile", {
      p_data: {
        full_name: form.full_name,
        phone_number: form.phone_number,
        location: form.location,
        skills: selectedSkills.join(", "),
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

  const msgBg = message.includes("success") || message.includes("saved") || message.includes("updated") || message.includes("uploaded")
    ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  const msgColor = message.includes("success") || message.includes("saved") || message.includes("updated") || message.includes("uploaded")
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
          <div style={{ ...card, position: "relative", zIndex: 1 }}>
            <h4 style={sectionTitle}>Skills & Resume</h4>
            <div style={fieldGroup}>
              <label style={label}>Skills</label>
              <div ref={skillDropdownRef} style={{ position: "relative" }}>
                <div ref={skillTriggerRef} style={skillInput} onClick={() => setShowSkillDropdown(!showSkillDropdown)}>
                  {selectedSkills.length === 0 ? (
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>
                      Select your skills...
                    </span>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", flex: 1 }}>
                        {selectedSkills.slice(0, 3).map((s) => (
                          <span key={s} style={skillTag}>
                            {s}
                            <span style={skillRemove} onClick={(e) => { e.stopPropagation(); removeSkill(s); }}>✕</span>
                          </span>
                        ))}
                        {selectedSkills.length > 3 && (
                          <span style={{ ...skillTag, backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                            +{selectedSkills.length - 3}
                          </span>
                        )}
                      </div>
                      <span style={skillCountBadge}>{selectedSkills.length}</span>
                    </>
                  )}
                  <span style={{ marginLeft: "4px", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>▼</span>
                </div>
                {showSkillDropdown && (
                  <div style={skillDropdown}>
                    {availableSkills.length === 0 ? (
                      <div style={{ padding: "10px", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                        No skills available from jobs yet.
                      </div>
                    ) : (
                      <>
                        <div style={skillSearchWrap}>
                          <span style={skillSearchIcon}>🔍</span>
                          <input style={skillSearchInput} placeholder="Search skills..." value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            ref={skillSearchRef} />
                          {searchTerm && (
                            <button style={skillSearchClear} onClick={() => setSearchTerm("")}>✕</button>
                          )}
                        </div>
                        <div style={skillDropdownHeader}>
                          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                            {selectedSkills.length} selected
                          </span>
                          {selectedSkills.length > 0 && (
                            <button style={skillClearBtn} onClick={clearAllSkills}>Clear All</button>
                          )}
                        </div>
                        {filteredSkills.length === 0 ? (
                          <div style={{ padding: "10px", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                            No skills match "{searchTerm}"
                          </div>
                        ) : (
                          filteredSkills.map((skill) => (
                            <label key={skill} style={skillOption}>
                              <input type="checkbox" checked={selectedSkills.includes(skill)}
                                onChange={() => toggleSkill(skill)} style={{ accentColor: "#4a90e2" }} />
                              <span>{skill}</span>
                            </label>
                          ))
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={fieldGroup}>
              <label style={label}>Resume</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button style={resumeUploadBtn} onClick={() => resumeInputRef.current.click()}>
                  {uploadingResume ? "⏳ Uploading..." : "📄 Choose File"}
                </button>
                {resumeFileName && (
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
                    {resumeFileName}
                  </span>
                )}
              </div>
              <input type="file" ref={resumeInputRef} onChange={handleResumeUpload}
                style={{ display: "none" }} accept=".pdf,.doc,.docx" />
              {resumeLink && (
                <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <a href={resumeLink} target="_blank" rel="noreferrer"
                    style={{ color: "#93c5fd", fontSize: "13px" }}>
                    📄 View Resume ↗
                  </a>
                  {resumeLink === profile?.resume_url && (
                    <span style={{ fontSize: "11px", color: "#86efac", fontWeight: "600" }}>✓ Saved</span>
                  )}
                  {resumeLink !== profile?.resume_url && (
                    <span style={{ fontSize: "11px", color: "#fbbf24", fontWeight: "600" }}>⚠ Not saved yet</span>
                  )}
                </div>
              )}
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

const skillInput = {
  display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px",
  minHeight: "44px", padding: "8px 12px", borderRadius: radii.sm,
  border: "1px solid rgba(255,255,255,0.15)",
  backgroundColor: "rgba(255,255,255,0.06)", color: "#fff",
  fontSize: "14px", cursor: "pointer", boxSizing: "border-box",
};
const skillTag = {
  display: "inline-flex", alignItems: "center", gap: "4px",
  fontSize: "12px", padding: "3px 8px", borderRadius: "6px",
  backgroundColor: "rgba(74,144,226,0.2)", color: "#93c5fd", fontWeight: "500",
};
const skillRemove = {
  cursor: "pointer", fontSize: "10px", marginLeft: "2px", opacity: 0.7,
  lineHeight: "1",
};
const skillDropdown = {
  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
  marginTop: "4px", borderRadius: radii.sm,
  backgroundColor: "rgba(15,23,42,0.98)", border: "1px solid rgba(255,255,255,0.15)",
  maxHeight: "190px", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};
const skillOption = {
  display: "flex", alignItems: "center", gap: "8px",
  padding: "8px 14px", cursor: "pointer", fontSize: "13px", color: "rgba(255,255,255,0.85)",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};
const skillCountBadge = {
  marginLeft: "auto", fontSize: "11px", fontWeight: "700", padding: "2px 8px",
  borderRadius: "10px", backgroundColor: "rgba(74,144,226,0.3)", color: "#93c5fd",
};
const skillSearchWrap = {
  position: "relative", top: 0, zIndex: 1,
  backgroundColor: "rgba(15,23,42,0.98)", padding: "8px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};
const skillSearchIcon = {
  position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)",
  fontSize: "13px", opacity: 0.4, pointerEvents: "none",
};
const skillSearchInput = {
  width: "100%", padding: "8px 12px 8px 32px", borderRadius: "6px",
  border: "1px solid rgba(255,255,255,0.12)", fontSize: "13px", outline: "none",
  boxSizing: "border-box", backgroundColor: "rgba(255,255,255,0.06)", color: "#fff",
  fontFamily: "'Inter', sans-serif",
};
const skillSearchClear = {
  position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer",
  fontSize: "12px", padding: "2px",
};
const skillDropdownHeader = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const skillClearBtn = {
  background: "none", border: "none", color: "#fca5a5", cursor: "pointer",
  fontSize: "12px", fontWeight: "600", padding: "2px 6px",
};
const resumeUploadBtn = {
  padding: "10px 16px", borderRadius: radii.sm,
  border: "1px solid rgba(255,255,255,0.15)",
  backgroundColor: "rgba(255,255,255,0.06)", color: "#fff",
  fontSize: "13px", cursor: "pointer", fontWeight: "500",
  fontFamily: "'Inter', sans-serif",
};
