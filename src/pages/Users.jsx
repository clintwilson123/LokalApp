import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { colors, radii, shadows } from "../uiStyles";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const { data } = await supabase.rpc("get_profiles_with_email");
    if (data) setUsers(data);
    setLoading(false);
  }

  async function updateUserStatus(userId, newStatus) {
    await supabase.from("profiles").update({ status: newStatus }).eq("id", userId);
    fetchUsers();
  }

  async function deleteUser(userId) {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    await supabase.from("profiles").delete().eq("id", userId);
    fetchUsers();
  }

  const badge = (val) => {
    const colorsMap = {
      active: "#22c55e", pending: "#d97706", suspended: "#f87171",
      admin: "#1a73e8", applicant: "#64748b",
    };
    return {
      fontSize: "11px", padding: "3px 10px", borderRadius: "20px",
      fontWeight: "600", backgroundColor: (colorsMap[val] || "#64748b") + "20",
      color: colorsMap[val] || "#64748b",
    };
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: colors.textSecondary }}>Loading users...</div>;
  }

  return (
    <div style={container}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", color: colors.navy, fontWeight: "800", margin: "0 0 4px" }}>Manage Users</h2>
        <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0 }}>{users.length} total user{users.length !== 1 ? "s" : ""}</p>
      </div>

      <div style={statsRow}>
        <div style={statCard}>
          <span style={{ fontSize: "22px" }}>👥</span>
          <div><h4 style={statNum}>{users.length}</h4><p style={statLabel}>Total</p></div>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: "22px" }}>✅</span>
          <div><h4 style={statNum}>{users.filter((u) => u.status === "active").length}</h4><p style={statLabel}>Active</p></div>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: "22px" }}>⌛</span>
          <div><h4 style={statNum}>{users.filter((u) => u.status === "pending").length}</h4><p style={statLabel}>Pending</p></div>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: "22px" }}>🚫</span>
          <div><h4 style={statNum}>{users.filter((u) => u.status === "suspended").length}</h4><p style={statLabel}>Suspended</p></div>
        </div>
      </div>

      <div style={tableWrapper}>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={headerRow}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Skills</th>
                <th style={thStyle}>Resume</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: colors.textSecondary }}>
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} style={rowStyle}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: "600", color: colors.navy, fontSize: "13px" }}>
                        {user.full_name || "N/A"}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: "12px", color: colors.textSecondary }}>{user.email || "—"}</div>
                    </td>
                    <td style={tdStyle}><span style={badge(user.role)}>{user.role}</span></td>
                    <td style={tdStyle}><span style={badge(user.status)}>{user.status}</span></td>
                    <td style={{ ...tdStyle, fontSize: "12px", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.skills || "—"}
                    </td>
                    <td style={tdStyle}>
                      {user.resume_url ? (
                        <a href={user.resume_url} target="_blank" rel="noopener noreferrer"
                          style={{ color: colors.primary, fontSize: "12px" }}>View</a>
                      ) : (
                        <span style={{ color: colors.textSecondary, fontSize: "12px" }}>None</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {user.status !== "active" && (
                          <button style={smallBtn(colors.success)}
                            onClick={() => updateUserStatus(user.id, "active")}>Approve</button>
                        )}
                        {user.status !== "suspended" && (
                          <button style={smallBtn(colors.danger)}
                            onClick={() => updateUserStatus(user.id, "suspended")}>Suspend</button>
                        )}
                        <button style={{ ...smallBtn(colors.danger), opacity: 0.6 }}
                          onClick={() => deleteUser(user.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const container = { padding: "5px" };
const statsRow = { display: "flex", gap: "12px", margin: "20px 0", flexWrap: "wrap" };
const statCard = {
  flex: "1 1 120px", backgroundColor: colors.white, padding: "14px", borderRadius: radii.sm,
  display: "flex", alignItems: "center", gap: "12px", boxShadow: shadows.sm,
};
const statNum = { margin: 0, fontSize: "18px", color: colors.navy };
const statLabel = { margin: 0, fontSize: "11px", color: colors.textSecondary };
const tableWrapper = {
  backgroundColor: "rgba(255,255,255,0.7)", borderRadius: radii.lg, padding: "16px", boxShadow: shadows.sm,
};
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "700px" };
const headerRow = { textAlign: "left", borderBottom: `1px solid ${colors.border}` };
const thStyle = { padding: "10px", color: colors.textSecondary, fontSize: "12px", fontWeight: "500" };
const rowStyle = { borderBottom: `1px solid ${colors.border}` };
const tdStyle = { padding: "10px", fontSize: "13px", color: colors.navy };
const smallBtn = (color) => ({
  padding: "4px 8px", fontSize: "11px", border: "none", borderRadius: "6px",
  backgroundColor: color + "20", color, cursor: "pointer", fontWeight: "600",
});
