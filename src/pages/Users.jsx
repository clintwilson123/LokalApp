import React from "react";

export default function Users() {
  const users = [
    { id: 1, name: "John Dela Cruz", email: "john.delacruz@example.com", role: "Admin", status: "Active", dateJoined: "January 15, 2024" },
    { id: 2, name: "Anna Santos", email: "john.delacruz@example.com", role: "User", status: "Pending", dateJoined: "March 20, 2024" },
    { id: 3, name: "Mark Reyes", email: "mark.reyes@e@example.com", role: "Employer", status: "Employer", dateJoined: "February 8, 2024" },
    { id: 4, name: "Carla Buenavista", email: "carla.buenavista@example.com", role: "User", status: "Active", dateJoined: "January 30, 2024" },
    { id: 5, name: "Kevin Mercudo", email: "kevin.mercudo@example.com", role: "User", status: "Active", dateJoined: "April 5, 2024" },
    { id: 6, name: "Grace Lim", email: "grace.lim@ee@example.com", role: "User", status: "Suspended", dateJoined: "December 22, 2023" },
  ];

  return (
    <div style={container}>
      {/* HEADER SECTION */}
      <div style={{ marginBottom: "25px" }}>
        <h2 style={titleText}>Manage Users</h2>
        <p style={subTitleText}>Administer and monitor all platform users</p>
      </div>

      {/* METRIC CARDS */}
      <div style={statsRow}>
        <div style={statCard}><span style={statIconBlue}>👥</span> <div><h4 style={statNum}>238</h4><p style={statLabel}>Total Users</p></div></div>
        <div style={statCard}><span style={statIconGreen}>✅</span> <div><h4 style={statNum}>180</h4><p style={statLabel}>Active Users</p></div></div>
        <div style={statCard}><span style={statIconYellow}>⌛</span> <div><h4 style={statNum}>12</h4><p style={statLabel}>Pending Applications</p></div></div>
        <div style={statCard}><span style={statIconRed}>🚫</span> <div><h4 style={statNum}>8</h4><p style={statLabel}>Suspended Users</p></div></div>
      </div>

      {/* TABLE CONTAINER */}
      <div style={tableWrapper}>
        {/* TOOLBAR */}
        <div style={toolbar}>
          <div style={{ display: "flex", gap: "10px" }}>
            <select style={filterDropdown}><option>All Status</option></select>
            <input style={searchInput} placeholder="🔍 Search" />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button style={outlineBtn}>📥 Export CSV</button>
            <button style={filledBtn}>📤 Export CSV</button>
          </div>
        </div>

        {/* TABLE */}
        <table style={tableStyle}>
          <thead>
            <tr style={headerRow}>
              <th style={thStyle}>Name ▴</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Date Joined ▴</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={rowStyle}>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={avatar}>👤</div>
                    <div><div style={userName}>{user.name}</div><div style={userEmail}>{user.email}</div></div>
                  </div>
                </td>
                <td style={tdStyle}>{user.email}</td>
                <td style={tdStyle}>{user.role}</td>
                <td style={tdStyle}>
                  <span style={getStatusStyle(user.status)}>{user.status}</span>
                </td>
                <td style={tdStyle}>{user.dateJoined}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <button style={actionBtn}>View</button>
                    <button style={actionBtn}>Edit</button>
                    <button style={actionBtnRed}>{user.status === 'Suspended' ? 'Delete' : 'Suspend'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* PAGINATION */}
        <div style={pagination}>
          <div><button style={pageBtn}>Previous</button><button style={pageBtn}>Next</button></div>
          <div style={pageInfo}>Previous <span style={activePage}>1</span> Next</div>
          <button style={reportsBtn}>🛡️ Reports ❯</button>
        </div>
      </div>
    </div>
  );
}

// --- HELPER FOR STATUS COLORS ---
const getStatusStyle = (status) => {
  const base = { padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600" };
  if (status === "Active") return { ...base, backgroundColor: "#e2f9eb", color: "#22c55e" };
  if (status === "Pending") return { ...base, backgroundColor: "#fef3c7", color: "#d97706" };
  if (status === "Employer") return { ...base, backgroundColor: "#e0f2fe", color: "#0ea5e9" };
  if (status === "Suspended") return { ...base, backgroundColor: "#fee2e2", color: "#f87171" };
  return base;
};

// --- STYLES REPLICATING THE UI ---
const container = { padding: "10px" };
const titleText = { color: "#1a3b5c", fontSize: "22px", margin: "0" };
const subTitleText = { color: "#64748b", fontSize: "14px", marginTop: "5px" };

const statsRow = { display: "flex", gap: "15px", margin: "20px 0" };
const statCard = { flex: 1, backgroundColor: "#fff", padding: "15px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "15px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" };
const statNum = { margin: 0, fontSize: "20px", color: "#1a3b5c" };
const statLabel = { margin: 0, fontSize: "12px", color: "#64748b" };

const statIconBlue = { fontSize: "24px", color: "#4a90e2", backgroundColor: "#eff6ff", padding: "8px", borderRadius: "10px" };
const statIconGreen = { fontSize: "24px", color: "#22c55e", backgroundColor: "#f0fdf4", padding: "8px", borderRadius: "10px" };
const statIconYellow = { fontSize: "24px", color: "#d97706", backgroundColor: "#fffbeb", padding: "8px", borderRadius: "10px" };
const statIconRed = { fontSize: "24px", color: "#f87171", backgroundColor: "#fef2f2", padding: "8px", borderRadius: "10px" };

const tableWrapper = { backgroundColor: "rgba(255, 255, 255, 0.6)", borderRadius: "20px", padding: "20px" };
const toolbar = { display: "flex", justifyContent: "space-between", marginBottom: "20px" };
const searchInput = { padding: "8px 15px", borderRadius: "8px", border: "1px solid #e2eaf4", width: "250px" };
const filterDropdown = { padding: "8px", borderRadius: "8px", border: "1px solid #e2eaf4", backgroundColor: "#fff" };

const filledBtn = { backgroundColor: "#4a90e2", color: "#fff", border: "none", padding: "8px 15px", borderRadius: "8px", cursor: "pointer" };
const outlineBtn = { backgroundColor: "transparent", color: "#4a90e2", border: "1px solid #4a90e2", padding: "8px 15px", borderRadius: "8px", cursor: "pointer" };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const headerRow = { textAlign: "left", borderBottom: "1px solid #e2eaf4" };
const thStyle = { padding: "12px", color: "#64748b", fontSize: "13px", fontWeight: "500" };
const rowStyle = { borderBottom: "1px solid #e2eaf4" };
const tdStyle = { padding: "12px", fontSize: "14px", color: "#1a3b5c" };

const avatar = { width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#e2eaf4", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "14px" };
const userName = { fontWeight: "600" };
const userEmail = { fontSize: "12px", color: "#64748b" };

const actionBtn = { background: "#f1f5f9", border: "none", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", color: "#1a73e8" };
const actionBtnRed = { ...actionBtn, color: "#f87171" };

const pagination = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px" };
const pageBtn = { background: "#f1f5f9", border: "none", padding: "5px 12px", margin: "0 2px", borderRadius: "4px", cursor: "pointer" };
const pageInfo = { fontSize: "14px", color: "#64748b" };
const activePage = { backgroundColor: "#4a90e2", color: "#fff", padding: "2px 8px", borderRadius: "4px" };
const reportsBtn = { backgroundColor: "#4a90e2", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "10px", cursor: "pointer" };