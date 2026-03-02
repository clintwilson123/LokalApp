import React from "react";

export default function Settings() {
  return (
    <div style={container}>
      <div style={headerSection}>
        <h2 style={mainTitle}>Manage Your Account Settings</h2>
        <p style={subTitle}>Customize your preferences and secure your account</p>
      </div>

      <div style={settingsGrid}>
        {/* COLUMN 1 */}
        <div style={column}>
          {/* Account Settings Card */}
          <div style={settingsCard}>
            <div style={cardHeader}>
              <span style={icon}>👤</span> <h4>Account Settings</h4>
            </div>
            <div style={fieldGroup}>
              <label style={label}>Full Name</label>
              <input style={input} defaultValue="John Dela Cruz" />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Email Address</label>
              <input style={input} defaultValue="john.delacruz@example.com" />
            </div>
            <div style={fieldGroup}>
              <label style={label}>Phone Number</label>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <input style={{ ...input, width: "70%" }} defaultValue="+63 912 345 6789" />
                <span style={textLink}>Change Password</span>
              </div>
            </div>
            <button style={primaryBtn}>Update Account</button>
          </div>

          {/* Privacy & Security Card */}
          <div style={settingsCard}>
            <div style={cardHeader}>
              <span style={icon}>🔒</span> <h4>Privacy & Security</h4>
            </div>
            <div style={rowItem}>
              <span>Two-Factor Authentication</span>
              <input type="checkbox" defaultChecked />
            </div>
            <div style={rowItem}>
              <span>Session History</span>
              <span style={dotIcon}>➖</span>
            </div>
            <div style={rowItem}>
              <span>Logout from all devices</span>
              <span style={dotIcon}>➖</span>
            </div>
            <button style={primaryBtn}>Save Preferences</button>
          </div>
        </div>

        {/* COLUMN 2 */}
        <div style={column}>
          {/* Notification Settings Card */}
          <div style={settingsCard}>
            <div style={cardHeader}>
              <span style={icon}>🔔</span> <h4>Notification Settings</h4>
            </div>
            <div style={checkboxItem}><input type="checkbox" defaultChecked /> Job Alerts</div>
            <div style={checkboxItem}><input type="checkbox" defaultChecked /> Interview Reminders</div>
            <div style={checkboxItem}><input type="checkbox" /> Email Notifications</div>
            <div style={checkboxItem}><input type="checkbox" /> SMS Notifications</div>
            <button style={primaryBtn}>Save Preferences</button>
          </div>

          {/* App Preferences Card */}
          <div style={settingsCard}>
            <div style={cardHeader}>
              <span style={icon}>🖥️</span> <h4>App Preferences</h4>
            </div>
            <div style={rowItem}>
              <span>Light Mode</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span>Dark Mode</span>
                <input type="checkbox" defaultChecked />
              </div>
            </div>
            <div style={rowItem}>
              <span>English</span>
              <select style={selectInput}><option>12 hour</option><option>24 hour</option></select>
            </div>
            <button style={primaryBtn}>Manage Security</button>
          </div>

          {/* Account Actions Card */}
          <div style={settingsCard}>
            <div style={cardHeader}>
              <span style={icon}>❗️</span> <h4>Account Actions</h4>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, color: "#f87171", cursor: "pointer" }}>Deactivate Account</p>
                <p style={{ margin: 0, color: "#64748b", fontSize: "12px" }}>Delete Account</p>
              </div>
              <button style={dangerBtn}>Delete Account</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- STYLES REPLICATING THE UI ---

const container = { padding: "10px" };
const headerSection = { marginBottom: "25px" };
const mainTitle = { color: "#1a3b5c", fontSize: "22px", fontWeight: "700", margin: "0 0 5px 0" };
const subTitle = { color: "#64748b", fontSize: "14px", margin: 0 };

const settingsGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" };
const column = { display: "flex", flexDirection: "column", gap: "20px" };

const settingsCard = { 
  backgroundColor: "rgba(255, 255, 255, 0.6)", 
  padding: "20px", 
  borderRadius: "16px", 
  boxShadow: "0 4px 6px rgba(0,0,0,0.02)" 
};

const cardHeader = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", color: "#1a3b5c" };
const icon = { fontSize: "18px" };

const fieldGroup = { marginBottom: "15px" };
const label = { display: "block", fontSize: "13px", color: "#64748b", marginBottom: "5px" };
const input = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2eaf4", background: "#f8fafc" };

const rowItem = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", fontSize: "14px", color: "#1a3b5c" };
const checkboxItem = { display: "flex", gap: "10px", marginBottom: "12px", fontSize: "14px", color: "#1a3b5c" };

const textLink = { color: "#1a73e8", fontSize: "12px", cursor: "pointer" };
const dotIcon = { color: "#cbd5e1" };

const primaryBtn = { 
  width: "100%", padding: "10px", background: "#4a90e2", color: "#fff", 
  border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer", marginTop: "10px" 
};

const dangerBtn = { background: "#f87171", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: "600", cursor: "pointer" };
const selectInput = { padding: "5px", borderRadius: "6px", border: "1px solid #e2eaf4", background: "#fff" };