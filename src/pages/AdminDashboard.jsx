import React from "react";
import { NavLink, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { colors, statusBadge, statusLabel } from "../uiStyles";

import { supabase } from "../lib/supabaseClient";
import ManageJobs from "./ManageJobs";
import AdminApplicants from "./AdminApplicants";
import AdminRecords from "./AdminRecords";
import Users from "./Users";
import { relativeTime } from "../lib/format";
const menuItems = [
  { name: "Dashboard", path: "/admin", icon: "📊", desc: "Overview" },
  { name: "Jobs", path: "/admin/jobs", icon: "💼", desc: "Post & Manage" },
  { name: "Applicants", path: "/admin/applicants", icon: "🔍", desc: "Skill Match" },
  { name: "Users", path: "/admin/users", icon: "👥", desc: "Manage" },
];

export default function AdminDashboard() {
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const handleLogout = () => signOut();

  const renderContent = () => {
    switch (location.pathname) {
      case "/admin": return <AdminDashboardHome />;
      case "/admin/jobs": return <ManageJobs />;
      case "/admin/applicants": return <AdminApplicants />;
      case "/admin/users": return <Users />;
      case "/admin/email-settings": return <AdminDashboardHome />;
      default: return <AdminDashboardHome />;
    }
  };

  if (location.pathname === "/admin-dashboard") {
    return <Navigate to="/admin" replace />;
  }

  const currentItem = menuItems.find((item) => item.path === location.pathname);
  const displayTitle = currentItem?.name || "Dashboard";

  return (
    <div style={dashboardLayout}>
      <aside style={sidebar}>
        <div style={sidebarInner}>
          <div style={logoText}>CJLink</div>

          <nav style={navSection}>
            <div style={navLabel}>MAIN MENU</div>
            {menuItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={{
                    ...navItem,
                    background: active
                      ? "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))"
                      : "transparent",
                    color: active ? "#fff" : "rgba(255,255,255,0.6)",
                    borderLeft: active ? "3px solid #60a5fa" : "3px solid transparent",
                  }}
                >
                  <span style={navIcon}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: active ? "700" : "500" }}>{item.name}</div>
                    <div style={{ fontSize: "11px", opacity: 0.6 }}>{item.desc}</div>
                  </div>
                </NavLink>
              );
            })}
          </nav>

          <div style={sidebarFooter}>
            <div style={profileStrip}>
              <div style={avatarSmall}>{profile?.full_name?.[0] || "A"}</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#fff" }}>{profile?.full_name || "Admin"}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{profile?.role}</div>
              </div>
            </div>
            <button onClick={handleLogout} style={logoutBtn}>
              <span>🚪</span> Logout
            </button>
          </div>
        </div>
      </aside>

      <main style={mainArea}>
        <div style={topBar}>
          <div>
            <h1 style={pageTitle}>{displayTitle}</h1>
            <p style={pageBreadcrumb}>Admin / {displayTitle}</p>
          </div>
          <div style={headerRight}>
            <span style={dateBadge}>{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>
        <div style={contentCard}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

/**
 * The order a candidate actually moves through, left to right.
 *
 * Six isolated counts said how much of everything existed and never what was
 * happening to it — "Applications: 12" next to "Hired: 1" tells you nothing
 * unless you can see the shape between them.
 */
const PIPELINE = [
  { key: "pending",             label: "Pending review", color: "#fbbf24" },
  { key: "reviewed",            label: "Reviewed",       color: "#93c5fd" },
  { key: "interview_scheduled", label: "Interview set",  color: "#c084fc" },
  { key: "accepted",            label: "Accepted",       color: "#4ade80" },
  { key: "hired",               label: "Hired",          color: "#22c55e" },
];

/**
 * Four of these cards open the rows behind their number directly beneath
 * themselves instead of navigating away: "Interviews: 4" drops the four
 * interviews down under the card, so the count is read where the people are
 * read. A card carrying `view` expands; a card carrying `to` navigates.
 *
 * Jobs is the exception — a list of jobs is somewhere you work (post, edit,
 * close), so it still goes to /admin/jobs.
 */
const STAT_META = [
  { key: "jobs",         label: "Jobs",         icon: "💼", accent: "#60a5fa", to: "/admin/jobs" },
  { key: "applicants",   label: "Applicants",   icon: "👤", accent: "#2dd4bf", view: "applicants" },
  { key: "applications", label: "Applications", icon: "📋", accent: "#818cf8", view: "applications" },
  { key: "interviews",   label: "Interviews",   icon: "📅", accent: "#c084fc", view: "interviews" },
  { key: "hired",        label: "Hired",        icon: "✅", accent: "#4ade80", view: "hired" },
];

/** "3 minutes ago" — now imported from lib/format so both admin screens
 *  describe elapsed time the same way. */
function AdminDashboardHome() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [stats, setStats] = React.useState({
    jobs: 0, applicants: 0, applications: 0, interviews: 0, pending: 0, rejected: 0, hired: 0,
  });
  const [pipeline, setPipeline] = React.useState({});
  const [topJobs, setTopJobs] = React.useState([]);
  const [recent, setRecent] = React.useState([]);
  const [loaded, setLoaded] = React.useState(false);
  // Which of the four cards is showing its rows. One at a time: an accordion
  // that allows several open panels buries the pipeline and the panels below
  // it, and the four lists are each a table.
  const [openStat, setOpenStat] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchOverview() {
      const [appsRes, jobsRes, applicantsRes, interviewsRes, recentRes] = await Promise.all([
        // One pass over every application's status instead of six separate
        // head counts. It costs a single short column per row — trivial at
        // this portal's scale — and yields the total AND the whole pipeline
        // from one round trip.
        supabase.from("applications").select("status"),
        // applications(count) is a PostgREST aggregate, so the per-job
        // numbers come back with the jobs rather than as N extra queries.
        supabase.from("jobs").select("id, title, status, applications(count)", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "applicant"),
        supabase.from("interviews").select("id", { count: "exact", head: true }),
        supabase
          .from("applications")
          .select("id, status, created_at, profiles(full_name), jobs(title, icon)")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;

      const rows = appsRes.data || [];
      const byStatus = rows.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {});

      setPipeline(byStatus);
      setStats({
        jobs: jobsRes.count || 0,
        applicants: applicantsRes.count || 0,
        applications: rows.length,
        interviews: interviewsRes.count || 0,
        pending: byStatus.pending || 0,
        rejected: byStatus.rejected || 0,
        hired: byStatus.hired || 0,
      });
      setTopJobs(
        (jobsRes.data || [])
          .map((job) => ({
            id: job.id,
            title: job.title,
            status: job.status,
            count: job.applications?.[0]?.count || 0,
          }))
          .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
          .slice(0, 5)
      );
      setRecent(recentRes.data || []);
      setLoaded(true);
    }

    fetchOverview();
    return () => { cancelled = true; };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (profile?.full_name || "Admin").split(" ")[0];

  const pipelineMax = Math.max(stats.applications, 1);
  const jobMax = Math.max(...topJobs.map((j) => j.count), 1);

  // The one number that is a to-do rather than a fact, so it leads.
  const waiting = stats.pending;

  return (
    <div>
      <div style={overviewHead}>
        <div style={{ minWidth: 0 }}>
          <h2 style={overviewTitle}>{greeting}, {firstName}</h2>
          <p style={overviewSub}>
            {!loaded
              ? "Loading overview…"
              : stats.applications === 0
                ? "No applications yet — this fills in as they arrive."
                : `Here's where CJTECH's hiring stands right now.`}
          </p>
        </div>
        <button onClick={() => navigate("/admin/jobs")} style={primaryBtn}>+ Post a job</button>
      </div>

      {/* The only card on this page that is a to-do rather than a fact. */}
      <div style={{
        ...attentionCard,
        borderColor: waiting > 0 ? "rgba(251,191,36,0.35)" : "rgba(74,222,128,0.3)",
        background: waiting > 0
          ? "linear-gradient(120deg, rgba(217,119,6,0.20), rgba(217,119,6,0.05))"
          : "linear-gradient(120deg, rgba(34,197,94,0.18), rgba(34,197,94,0.05))",
      }}>
        <span style={{ ...attentionIcon, background: waiting > 0 ? "rgba(251,191,36,0.18)" : "rgba(74,222,128,0.18)" }}>
          {waiting > 0 ? "⏳" : "🎉"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...attentionKicker, color: waiting > 0 ? "#fcd34d" : "#86efac" }}>
            {waiting > 0 ? "Needs your attention" : "All caught up"}
          </div>
          <div style={attentionLine}>
            {waiting > 0 ? (
              <><strong>{waiting}</strong> application{waiting === 1 ? "" : "s"} waiting to be reviewed</>
            ) : (
              <>Nothing is waiting for review.</>
            )}
          </div>
          {stats.rejected > 0 && (
            <div style={attentionNote}>{stats.rejected} not selected</div>
          )}
        </div>
        <button onClick={() => navigate("/admin/applicants")} style={attentionBtn}>
          {waiting > 0 ? "Review now" : "View applicants"} →
        </button>
      </div>

      {/* Every card is a way in. A number you cannot act on is trivia. */}
      <div style={statRow}>
        {STAT_META.map((s) => (
          <button
            key={s.key}
            onClick={() =>
              s.view
                ? setOpenStat(openStat === s.view ? null : s.view)
                : navigate(s.to)
            }
            aria-expanded={s.view ? openStat === s.view : undefined}
            style={{ ...statCard, borderColor: `${s.accent}33` }}
          >
            <span style={{ ...statTile, background: `${s.accent}1f`, color: s.accent }}>{s.icon}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={statNum}>{stats[s.key]}</div>
              <div style={statLabel}>{s.label}</div>
            </div>
            {/* A caret says "this opens here"; an arrow says "this goes
                somewhere". Only Jobs goes somewhere. */}
            <span style={{ ...statArrow, color: s.accent }}>
              {s.view ? (openStat === s.view ? "▴" : "▾") : "→"}
            </span>
          </button>
        ))}
      </div>

      {openStat && (
        <AdminRecords
          key={openStat}
          view={openStat}
          variant="dropdown"
          onClose={() => setOpenStat(null)}
        />
      )}

      <div style={panel}>
        <div style={panelHead}>
          <h3 style={panelTitle}>Hiring pipeline</h3>
          <span style={panelMeta}>
            {stats.applications} application{stats.applications === 1 ? "" : "s"} in total
          </span>
        </div>
        {!loaded ? (
          <p style={emptyText}>Loading…</p>
        ) : stats.applications === 0 ? (
          <p style={emptyText}>Nothing to chart yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>
            {PIPELINE.map((step) => {
              const n = pipeline[step.key] || 0;
              const pct = Math.round((n / pipelineMax) * 100);
              return (
                <div key={step.key} style={pipeRow}>
                  <span style={{ ...pipeLabel, color: step.color }}>{step.label}</span>
                  <div style={pipeTrack}>
                    <div style={{
                      ...pipeFill,
                      width: `${n === 0 ? 0 : Math.max(pct, 3)}%`,
                      background: `linear-gradient(90deg, ${step.color}, ${step.color}66)`,
                    }} />
                  </div>
                  <span style={pipeValue}>{n}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={twoCol}>
        <div style={panel}>
          <div style={panelHead}>
            <h3 style={panelTitle}>Applications by job</h3>
          </div>
          {!loaded ? (
            <p style={emptyText}>Loading…</p>
          ) : topJobs.length === 0 ? (
            <p style={emptyText}>No jobs posted yet.</p>
          ) : (
            topJobs.map((job) => (
              <button key={job.id} onClick={() => navigate("/admin/jobs")} style={jobRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={rowTitle}>{job.title}</div>
                  <div style={{ ...rowMeta, color: job.status === "published" ? "#4ade80" : "rgba(255,255,255,0.4)" }}>
                    {job.status === "published" ? "Live" : job.status}
                  </div>
                </div>
                <div style={{ width: "90px", flexShrink: 0 }}>
                  <div style={pipeTrack}>
                    <div style={{
                      ...pipeFill,
                      width: `${job.count === 0 ? 0 : Math.max(Math.round((job.count / jobMax) * 100), 6)}%`,
                      background: "linear-gradient(90deg, #60a5fa, #60a5fa66)",
                    }} />
                  </div>
                </div>
                <span style={jobCount}>{job.count}</span>
              </button>
            ))
          )}
        </div>

        <div style={panel}>
          <div style={panelHead}>
            <h3 style={panelTitle}>Recent activity</h3>
          </div>
          {!loaded ? (
            <p style={emptyText}>Loading…</p>
          ) : recent.length === 0 ? (
            <p style={emptyText}>No applications yet.</p>
          ) : (
            recent.map((a) => (
              <div key={a.id} style={activityRow}>
                <span style={activityAvatar}>
                  {(a.profiles?.full_name || "?").trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={rowTitle}>{a.profiles?.full_name || "Unnamed applicant"}</div>
                  <div style={rowMeta}>{a.jobs?.title || "a job"}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={statusBadge(a.status)}>{statusLabel(a.status)}</span>
                  <div style={rowMeta}>{relativeTime(a.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const dashboardLayout = { display: "flex", minHeight: "100vh", background: colors.bg };
const sidebar = { width: "270px", background: `linear-gradient(180deg, ${colors.navy} 0%, #0f2840 100%)`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" };
const sidebarInner = { padding: "28px 18px", display: "flex", flexDirection: "column", height: "100%" };
const logoText = { fontSize: "24px", fontWeight: "800", color: "#fff", marginBottom: "36px", paddingLeft: "6px" };
const navSection = { flex: 1 };
const navLabel = { fontSize: "10px", fontWeight: "700", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginBottom: "12px", paddingLeft: "6px" };
const navItem = { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "12px", marginBottom: "4px", fontSize: "14px", textDecoration: "none", transition: "all 0.2s" };
const navIcon = { fontSize: "20px", width: "32px", textAlign: "center" };
const sidebarFooter = { borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px" };
const profileStrip = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", padding: "0 6px" };
const avatarSmall = { width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #60a5fa, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", color: "#fff" };
const logoutBtn = { width: "100%", padding: "10px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", color: colors.danger, cursor: "pointer", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center", transition: "all 0.2s" };
const mainArea = { flex: 1, padding: "32px 40px", overflow: "auto" };
const topBar = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" };
const pageTitle = { fontSize: "26px", fontWeight: "800", color: "#fff", margin: 0 };
const pageBreadcrumb = { fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "2px" };
const headerRight = { display: "flex", alignItems: "center", gap: "12px" };
const dateBadge = { fontSize: "12px", color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.08)", padding: "6px 14px", borderRadius: "20px", fontWeight: "500", border: "1px solid rgba(255,255,255,0.1)" };
const contentCard = { background: "rgba(255, 255, 255, 0.06)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: "24px", padding: "32px", minHeight: "600px", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(26,59,92,0.15)" };

const overviewHead = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "22px" };
const overviewTitle = { fontSize: "22px", color: "#fff", fontWeight: "800", margin: 0 };
const overviewSub = { fontSize: "13px", color: "rgba(255,255,255,0.55)", margin: "4px 0 0" };
const primaryBtn = {
  flexShrink: 0, padding: "10px 18px", borderRadius: "12px", border: "none",
  background: "linear-gradient(135deg, #60a5fa, #3b82f6)", color: "#fff",
  fontSize: "13px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s",
  boxShadow: "0 6px 18px rgba(59,130,246,0.3)",
};

// The to-do, promoted above the facts.
const attentionCard = {
  display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
  padding: "20px 22px", borderRadius: "18px", marginBottom: "16px",
  border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)",
};
const attentionIcon = {
  width: "46px", height: "46px", borderRadius: "14px", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px",
};
const attentionKicker = { fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase" };
const attentionLine = { fontSize: "16px", color: "#fff", fontWeight: "500", marginTop: "3px" };
const attentionNote = { fontSize: "12px", color: "rgba(255,255,255,0.45)", marginTop: "3px" };
const attentionBtn = {
  flexShrink: 0, marginLeft: "auto", padding: "10px 18px", borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.1)",
  color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s",
};

const statRow = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "16px" };
const statCard = {
  display: "flex", alignItems: "center", gap: "12px", textAlign: "left",
  padding: "15px 16px", borderRadius: "16px", cursor: "pointer",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  transition: "all 0.2s",
};
const statTile = {
  width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px",
};
const statNum = { fontSize: "21px", fontWeight: "800", color: "#fff", lineHeight: "1.1" };
const statLabel = { fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "2px" };
const statArrow = { marginLeft: "auto", fontSize: "15px", opacity: 0.6, flexShrink: 0 };

const panel = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "18px", padding: "20px", marginBottom: "16px",
};
const panelHead = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginBottom: "16px" };
const panelTitle = { fontSize: "14px", color: "#fff", fontWeight: "700", margin: 0 };
const panelMeta = { fontSize: "11px", color: "rgba(255,255,255,0.4)" };
const emptyText = { fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: 0 };

const pipeRow = { display: "flex", alignItems: "center", gap: "12px" };
const pipeLabel = { width: "118px", flexShrink: 0, fontSize: "12px", fontWeight: "600" };
const pipeTrack = { flex: 1, height: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.07)", overflow: "hidden", minWidth: 0 };
const pipeFill = { height: "100%", borderRadius: "6px", transition: "width 0.4s ease" };
const pipeValue = { width: "26px", flexShrink: 0, textAlign: "right", fontSize: "13px", fontWeight: "700", color: "#fff" };

const twoCol = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" };
const jobRow = {
  display: "flex", alignItems: "center", gap: "12px", width: "100%", textAlign: "left",
  padding: "11px 12px", borderRadius: "12px", border: "none", cursor: "pointer",
  background: "transparent", transition: "background 0.15s", marginBottom: "2px",
};
const rowTitle = { fontSize: "13px", fontWeight: "600", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const rowMeta = { fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "2px" };
const jobCount = { width: "26px", flexShrink: 0, textAlign: "right", fontSize: "14px", fontWeight: "800", color: "#fff" };

const activityRow = { display: "flex", alignItems: "center", gap: "11px", padding: "10px 12px", borderRadius: "12px", marginBottom: "2px" };
const activityAvatar = {
  width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "linear-gradient(135deg, #60a5fa, #3b82f6)",
  fontSize: "13px", fontWeight: "700", color: "#fff",
};
