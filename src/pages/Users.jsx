import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { colors, dashTable, dashTh, dashTd, dashRow, dashStatCard, dashStatNum, dashStatLabel, dashBadge, dashSmallBtn } from "../uiStyles";
import { SkeletonTable } from "../components/Skeleton";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [fetchError, setFetchError] = useState("");

  const fetchUsers = async () => {
    setFetchError("");
    setLoading(true);

    // Source of truth: get_profiles_with_email() (SECURITY DEFINER,
    // admin-gated, joins auth.users for the real email).
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_profiles_with_email");

    if (rpcData && rpcData.length > 0) {
      setUsers(rpcData);
      setLoading(false);
      return;
    }

    // Fallback: profiles only. Emails are NOT available client-side —
    // auth.admin.listUsers() requires the service-role key, which must
    // never ship in the browser, so it is not called here.
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, status, phone_number, location, skills, resume_url, created_at")
      .order("created_at", { ascending: false });

    if (profileError) {
      setFetchError("Failed to load users: " + profileError.message);
      setLoading(false);
      return;
    }

    if (rpcError) {
      setFetchError(
        "Loaded users, but emails are unavailable — get_profiles_with_email() could not be called: " +
        rpcError.message
      );
    }

    setUsers(profiles || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  async function updateUserStatus(userId, newStatus) {
    setMessage("");
    try {
      const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("id", userId);
      if (error) throw error;
      setMessage(`Status updated to "${newStatus}" successfully.`);
      fetchUsers();
    } catch (err) {
      setMessage("Failed to update: " + err.message);
    }
  }

  async function deleteUser(userId) {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    setMessage("");
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      setMessage("User deleted successfully.");
      fetchUsers();
    } catch (err) {
      setMessage("Failed to delete: " + err.message);
    }
  }

  const badge = (val) => {
    const colorsMap = {
      active: "#22c55e", pending: "#d97706",
      admin: "#4a90e2", applicant: "#64748b",
    };
    const c = colorsMap[val] || "#64748b";
    return dashBadge(c + "20", c);
  };

  if (loading) {
    return <div style={{ padding: "5px" }}><SkeletonTable rows={5} cols={7} /></div>;
  }

  return (
    <div style={container}>
      <style>{`
        .skill-more-btn:hover {
          border-color: rgba(74,144,226,0.55);
          color: #93c5fd;
          background: rgba(74,144,226,0.08);
        }
      `}</style>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", color: "#fff", fontWeight: "800", margin: "0 0 4px" }}>Manage Users</h2>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>{users.length} total user{users.length !== 1 ? "s" : ""}</p>
      </div>

      {message && (
        <p style={{
          padding: "10px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", marginBottom: "16px",
          backgroundColor: message.includes("Failed") ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
          color: message.includes("Failed") ? colors.danger : colors.success,
        }}>
          {message}
        </p>
      )}

      {fetchError && (
        <p style={{
          padding: "10px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", marginBottom: "16px",
          backgroundColor: "rgba(239,68,68,0.15)", color: "#fca5a5",
        }}>
          {fetchError}
        </p>
      )}

      <div style={statsRow}>
        <div style={dashStatCard}>
          <span style={{ fontSize: "22px" }}>👥</span>
          <div><h4 style={dashStatNum}>{users.length}</h4><p style={dashStatLabel}>Total</p></div>
        </div>
        <div style={dashStatCard}>
          <span style={{ fontSize: "22px" }}>✅</span>
          <div><h4 style={dashStatNum}>{users.filter((u) => u.status === "active").length}</h4><p style={dashStatLabel}>Active</p></div>
        </div>
        <div style={dashStatCard}>
          <span style={{ fontSize: "22px" }}>⌛</span>
          <div><h4 style={dashStatNum}>{users.filter((u) => u.status === "pending").length}</h4><p style={dashStatLabel}>Pending</p></div>
        </div>
      </div>

      <div style={dashTable}>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={dashRow}>
                <th style={dashTh}>Name</th>
                <th style={dashTh}>Email</th>
                <th style={dashTh}>Role</th>
                <th style={dashTh}>Status</th>
                <th style={dashTh}>Skills</th>
                <th style={dashTh}>Resume</th>
                <th style={dashTh}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "rgba(255,255,255,0.5)" }}>
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} style={dashRow}>
                    <td style={dashTd}>
                      <div style={{ fontWeight: "600", fontSize: "13px" }}>
                        {user.full_name || "N/A"}
                      </div>
                    </td>
                    <td style={dashTd}>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>{user.email || "—"}</div>
                    </td>
                    <td style={dashTd}><span style={badge(user.role)}>{user.role}</span></td>
                    <td style={dashTd}><span style={badge(user.status)}>{user.status}</span></td>
                    <td style={{ ...dashTd, minWidth: "170px" }}>
                      <SkillCell skills={user.skills} />
                    </td>
                    <td style={dashTd}>
                      {user.resume_url ? (
                        <a href={user.resume_url} target="_blank" rel="noopener noreferrer"
                          style={{ color: "#93c5fd", fontSize: "12px" }}>View</a>
                      ) : (
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>None</span>
                      )}
                    </td>
                    <td style={dashTd}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {user.status !== "active" && (
                          <button style={dashSmallBtn("#22c55e")}
                            onClick={() => updateUserStatus(user.id, "active")}>Approve</button>
                        )}
                        {user.status !== "suspended" && user.role !== "admin" && (
                          <button style={{ ...dashSmallBtn("#d97706") }}
                            onClick={() => updateUserStatus(user.id, "suspended")}>Suspend</button>
                        )}
                        <button style={{ ...dashSmallBtn("#ef4444"), opacity: 0.6 }}
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
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "700px" };

const skillTag = {
  fontSize: "11px",
  padding: "3px 9px",
  borderRadius: "6px",
  backgroundColor: "rgba(148,163,184,0.12)",
  border: "1px solid rgba(148,163,184,0.22)",
  color: "rgba(226,232,240,0.88)",
  fontWeight: "500",
  letterSpacing: "0.2px",
  whiteSpace: "nowrap",
  lineHeight: "1.4",
};
const skillMoreBtn = {
  fontSize: "11px",
  padding: "3px 10px",
  borderRadius: "6px",
  backgroundColor: "transparent",
  border: "1px dashed rgba(148,163,184,0.4)",
  color: "rgba(148,163,184,0.95)",
  cursor: "pointer",
  fontWeight: "600",
  whiteSpace: "nowrap",
  lineHeight: "1.4",
  letterSpacing: "0.2px",
};

function SkillCell({ skills }) {
  const [expanded, setExpanded] = useState(false);

  if (!skills || !skills.trim()) {
    return <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>—</span>;
  }

  const list = skills.split(",").map((s) => s.trim()).filter(Boolean);
  const VISIBLE = 2;
  const hasMore = list.length > VISIBLE;
  const shown = expanded || !hasMore ? list : list.slice(0, VISIBLE);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
      {shown.map((s, i) => (
        <span key={i} style={skillTag}>{s}</span>
      ))}
      {hasMore && (
        <button
          className="skill-more-btn"
          style={skillMoreBtn}
          onClick={() => setExpanded(!expanded)}
          title={expanded ? "Show fewer skills" : `Show ${list.length - VISIBLE} more skills`}
        >
          {expanded ? `Less ▴` : `+${list.length - VISIBLE} more ▾`}
        </button>
      )}
    </div>
  );
}
