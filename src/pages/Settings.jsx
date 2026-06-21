import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { colors, radii, shadows } from "../uiStyles";

export default function Settings() {
  const { user, profile, loadProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    location: "",
  });

  const [prefs, setPrefs] = useState({
    job_alerts: true,
    interview_reminders: true,
    email_notifications: false,
    sms_notifications: false,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        location: profile.location || "",
      });
    }
    if (profile?.preferences) {
      try {
        const p = typeof profile.preferences === "string" ? JSON.parse(profile.preferences) : profile.preferences;
        setPrefs({ ...prefs, ...p });
      } catch { /* keep defaults */ }
    }
  }, [profile]);

  async function handleSaveAccount() {
    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    if (error) {
      setMessage("Error: " + error.message);
    } else {
      setMessage("Account updated successfully!");
      loadProfile(user.id);
    }
    setSaving(false);
  }

  async function handleSavePrefs() {
    setSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("profiles")
      .update({ preferences: prefs })
      .eq("id", user.id);
    if (error) {
      setMessage("Error: " + error.message);
    } else {
      setMessage("Preferences saved!");
    }
    setSaving(false);
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm("Are you sure you want to delete your account? This cannot be undone.");
    if (!confirmed) return;
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    if (error) {
      setMessage("Delete failed: " + error.message);
    } else {
      await supabase.auth.signOut();
      window.location.href = "/";
    }
  }

  return (
    <div style={container}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", color: colors.navy, fontWeight: "800", margin: "0 0 4px" }}>Account Settings</h2>
        <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0 }}>Manage your profile and preferences</p>
      </div>

      {message && (
        <p style={{
          padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "600",
          backgroundColor: message.includes("success") || message.includes("updated") || message.includes("saved") ? "#e2f9eb" : "#fee2e2",
          color: message.includes("success") || message.includes("updated") || message.includes("saved") ? colors.success : colors.danger,
          textAlign: "center",
        }}>
          {message}
        </p>
      )}

      <div style={settingsGrid}>
        <div style={column}>
          <div style={settingsCard}>
            <div style={cardHeader}>
              <span style={{ fontSize: "18px", marginRight: "8px" }}>👤</span>
              <h4 style={{ margin: 0, color: colors.navy }}>Account Details</h4>
            </div>
            <div style={fieldGroup}>
              <label style={label}>Full Name</label>
              <input style={input} value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Email</label>
              <input style={input} value={user?.email || ""} disabled />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Phone</label>
              <input style={input} value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Location</label>
              <input style={input} value={form.location} placeholder="e.g., Toledo City, Cebu"
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <button style={{ ...btn, width: "100%" }} onClick={handleSaveAccount} disabled={saving}>
              {saving ? "Saving..." : "Update Account"}
            </button>
          </div>

          <div style={settingsCard}>
            <div style={cardHeader}>
              <span style={{ fontSize: "18px", marginRight: "8px" }}>🔔</span>
              <h4 style={{ margin: 0, color: colors.navy }}>Notifications</h4>
            </div>
            {[
              { key: "job_alerts", label: "Job Alerts" },
              { key: "interview_reminders", label: "Interview Reminders" },
              { key: "email_notifications", label: "Email Notifications" },
              { key: "sms_notifications", label: "SMS Notifications" },
            ].map(({ key, label }) => (
              <div key={key} style={checkboxItem}>
                <input type="checkbox" checked={prefs[key]} onChange={() => setPrefs({ ...prefs, [key]: !prefs[key] })} />
                <span>{label}</span>
              </div>
            ))}
            <button style={{ ...btn, width: "100%", marginTop: "12px" }} onClick={handleSavePrefs} disabled={saving}>
              Save Preferences
            </button>
          </div>
        </div>

        <div style={column}>
          <div style={settingsCard}>
            <div style={cardHeader}>
              <span style={{ fontSize: "18px", marginRight: "8px" }}>🔒</span>
              <h4 style={{ margin: 0, color: colors.navy }}>Security</h4>
            </div>
            <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "12px" }}>
              Email: <strong>{user?.email}</strong>
            </p>
            <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "12px" }}>
              Role: <strong style={{ color: colors.primary }}>{profile?.role}</strong>
            </p>
            <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "16px" }}>
              Joined: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
            </p>
            <button style={{ ...btn, width: "100%", backgroundColor: colors.danger }}
              onClick={handleDeleteAccount}>
              Delete Account
            </button>
          </div>

          <div style={settingsCard}>
            <div style={cardHeader}>
              <span style={{ fontSize: "18px", marginRight: "8px" }}>📄</span>
              <h4 style={{ margin: 0, color: colors.navy }}>Skills</h4>
            </div>
            <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "8px" }}>
              Your current skills: {profile?.skills || "Not set"}
            </p>
            <p style={{ fontSize: "12px", color: colors.textSecondary }}>
              Update your skills from the <a href="/profile" style={{ color: colors.primaryDark }}>Profile</a> page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const container = { padding: "5px" };
const settingsGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" };
const column = { display: "flex", flexDirection: "column", gap: "20px" };
const settingsCard = {
  backgroundColor: "rgba(255,255,255,0.6)", padding: "20px", borderRadius: radii.lg, boxShadow: shadows.sm,
};
const cardHeader = { display: "flex", alignItems: "center", marginBottom: "16px" };
const fieldGroup = { marginBottom: "14px" };
const label = { display: "block", fontSize: "12px", color: colors.textSecondary, marginBottom: "4px", fontWeight: "500" };
const input = {
  width: "100%", padding: "10px 12px", borderRadius: "8px", border: `1px solid ${colors.border}`,
  fontSize: "14px", outline: "none", boxSizing: "border-box", backgroundColor: colors.white,
};
const btn = {
  padding: "10px", backgroundColor: colors.primaryDark, color: "#fff", border: "none",
  borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "14px",
};
const checkboxItem = {
  display: "flex", gap: "10px", marginBottom: "10px", fontSize: "14px", color: colors.navy,
};
