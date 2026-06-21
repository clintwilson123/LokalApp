import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { colors, shadows } from "../uiStyles";

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  async function fetchNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setNotifications(data);
    setLoading(false);
  }

  async function deleteNotification(id) {
    await supabase.from("notifications").delete().eq("id", id);
    fetchNotifications();
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: colors.textSecondary }}>Loading...</div>;
  }

  return (
    <div style={container}>
      <h2 style={mainTitle}>NOTIFICATIONS</h2>

      <div style={notifList}>
        {notifications.length === 0 ? (
          <p style={{ textAlign: "center", color: colors.textSecondary, padding: "30px" }}>
            No notifications yet.
          </p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} style={notifPill}>
              <div style={textContent}>
                <p style={notifMsg}>{n.message}</p>
                <span style={notifDate}>
                  {new Date(n.created_at).toLocaleDateString()} · {new Date(n.created_at).toLocaleTimeString()}
                </span>
              </div>
              <button
                style={deleteBtn}
                onClick={() => deleteNotification(n.id)}
                aria-label="Delete"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const container = { padding: "10px", textAlign: "center" };
const mainTitle = { fontSize: "22px", fontWeight: "800", color: colors.navy, marginBottom: "24px", letterSpacing: "1px" };
const notifList = { display: "flex", flexDirection: "column", gap: "10px", maxWidth: "750px", margin: "0 auto" };
const notifPill = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: colors.white,
  padding: "14px 20px",
  borderRadius: "50px",
  boxShadow: shadows.sm,
  borderLeft: `6px solid ${colors.primary}`,
  textAlign: "left",
  gap: "12px",
};
const textContent = { flex: 1 };
const notifMsg = { margin: 0, fontSize: "14px", fontWeight: "500", color: colors.navy, lineHeight: "1.4" };
const notifDate = { fontSize: "11px", color: colors.textSecondary, marginTop: "4px", display: "block" };
const deleteBtn = {
  backgroundColor: colors.bg,
  border: "none",
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  color: colors.textSecondary,
  fontSize: "14px",
};
