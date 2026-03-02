import React from "react";

export default function Reports() {
  const activities = [
    { date: "April 24, 2024", time: "8:17 AM", activity: "Suspicious Login", location: "Manila, Philippines", ip: "192.34.56.78", device: "Chrome on Windows", type: "critical" },
    { date: "April 22, 2024", time: "2:55 PM", activity: "Suspicious Login", location: "Cebu, Philippines", ip: "192.34.56.78", device: "Chrome on Windows", type: "critical" },
    { date: "April 20, 2024", time: "6:48 PM", activity: "Failed Login Attempt", location: "Manila, Philippines", ip: "167.89.45.23", device: "iPhone (Safari)", type: "warning" },
    { date: "April 18, 2024", time: "6:28 AM", activity: "New Device Sign-in", location: "Manila, Philippines", ip: "167.89.45.23", device: "Edge on Windows", type: "info" },
    { date: "April 18, 2024", time: "5:36 AM", activity: "Failed Login Attempt", location: "Caloocan, Philippines", ip: "167.89.45.23", device: "Galaxy S22 (Chrome)", type: "warning" },
  ];

  return (
    <div style={container}>
      {/* HEADER SECTION */}
      <div style={{ marginBottom: "25px" }}>
        <h2 style={titleText}>Security Report</h2>
        <p style={subTitleText}>Monitor your account and recent activity</p>
      </div>

      {/* SUMMARY CARDS */}
      <div style={summaryRow}>
        <div style={summaryCard}><span style={iconBlue}>🔍</span> <div><h4 style={summaryNum}>3</h4><p style={summaryLabel}>Suspicious Logins</p></div></div>
        <div style={summaryCard}><span style={iconYellow}>⚡</span> <div><h4 style={summaryNum}>2</h4><p style={summaryLabel}>Failed Login Attempts</p></div></div>
        <div style={summaryCard}><span style={iconBlue}>💻</span> <div><h4 style={summaryNum}>1</h4><p style={summaryLabel}>New Device Detected</p></div></div>
        <div style={summaryCard}><span style={iconBlue}>📄</span> <div><h4 style={summaryNum}>5</h4><p style={summaryLabel}>Recent Reports</p></div></div>
      </div>

      {/* ACTIVITY TABLE CONTAINER */}
      <div style={tableWrapper}>
        <div style={tableHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "#d97706" }}>🛡️</span>
            <span style={{ fontWeight: "700", color: "#1a3b5c" }}>Recent Activity</span>
            <select style={dateFilter}><option>Past 30 Days</option></select>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <input style={searchInput} placeholder="🔍 Search" />
            <button style={generateBtn}>Generate Report</button>
          </div>
        </div>

        <table style={tableStyle}>
          <thead>
            <tr style={thRow}>
              <th style={thStyle}>Date ▴</th>
              <th style={thStyle}>Activity</th>
              <th style={thStyle}>Location</th>
              <th style={thStyle}>IP Address</th>
              <th style={thStyle}>Device/Browser</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((item, index) => (
              <tr key={index} style={trStyle}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: "500" }}>{item.date}</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{item.time}</div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={getStatusIconStyle(item.type)}>{getStatusIcon(item.type)}</span>
                    <span style={getStatusTextStyle(item.type)}>{item.activity}</span>
                  </div>
                </td>
                <td style={tdStyle}>{item.location}</td>
                <td style={tdStyle}>{item.ip}</td>
                <td style={tdStyle}>{item.device}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* FOOTER ACTIONS */}
        <div style={footerRow}>
          <div style={pagination}>Previous <span style={activePage}>1</span> Next</div>
          <button style={reportIssueBtn}>🛡️ Report Issue</button>
        </div>
      </div>
    </div>
  );
}

// --- HELPER FUNCTIONS FOR UI LOGIC ---
const getStatusIcon = (type) => {
  if (type === "critical") return "🔴";
  if (type === "warning") return "⚠️";
  return "✅";
};

const getStatusTextStyle = (type) => {
  if (type === "critical") return { color: "#b91c1c", fontWeight: "500" };
  if (type === "warning") return { color: "#1a3b5c", fontWeight: "500" };
  if (type === "info") return { color: "#1a3b5c", fontWeight: "500" };
};

const getStatusIconStyle = (type) => ({
  fontSize: "14px",
  display: "inline-flex"
});

// --- STYLES REPLICATING THE UI ---
const container = { padding: "10px" };
const titleText = { color: "#1a3b5c", fontSize: "22px", margin: "0" };
const subTitleText = { color: "#64748b", fontSize: "14px", marginTop: "5px" };

const summaryRow = { display: "flex", gap: "15px", margin: "20px 0" };
const summaryCard = { flex: 1, backgroundColor: "#fff", padding: "15px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "15px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" };
const summaryNum = { margin: 0, fontSize: "20px", color: "#1a3b5c" };
const summaryLabel = { margin: 0, fontSize: "12px", color: "#64748b" };

const iconBlue = { color: "#4a90e2", backgroundColor: "#eff6ff", padding: "8px", borderRadius: "10px" };
const iconYellow = { color: "#d97706", backgroundColor: "#fffbeb", padding: "8px", borderRadius: "10px" };

const tableWrapper = { backgroundColor: "rgba(255, 255, 255, 0.6)", borderRadius: "20px", padding: "20px" };
const tableHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" };
const dateFilter = { padding: "6px 12px", borderRadius: "8px", border: "1px solid #e2eaf4", background: "#fff", fontSize: "13px" };
const searchInput = { padding: "8px 15px", borderRadius: "8px", border: "1px solid #e2eaf4", width: "200px" };
const generateBtn = { backgroundColor: "#4a90e2", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thRow = { textAlign: "left", borderBottom: "1px solid #e2eaf4" };
const thStyle = { padding: "12px", color: "#64748b", fontSize: "13px", fontWeight: "400" };
const trStyle = { borderBottom: "1px solid #e2eaf4" };
const tdStyle = { padding: "15px 12px", fontSize: "14px", color: "#1a3b5c" };

const footerRow = { display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: "20px", gap: "20px" };
const pagination = { color: "#64748b", fontSize: "14px" };
const activePage = { backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 10px", borderRadius: "4px", margin: "0 10px" };
const reportIssueBtn = { backgroundColor: "#4a90e2", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "600" };