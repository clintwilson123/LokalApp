import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { dashTable, dashTh, dashTd, dashRow, statusBadge, statusLabel } from "../uiStyles";
import { SkeletonLine, SkeletonCard } from "../components/Skeleton";
import { formatDateShort, formatTime, relativeTime } from "../lib/format";

/**
 * Who is behind each of the dashboard's four numbers.
 *
 * The overview cards used to navigate away to a page that showed one single
 * kind of row — "Interviews: 4" opened a skill-match screen with no
 * interviews on it. Each card now drops this list down beneath itself, so
 * the people are read where the count was read.
 *
 * Mount only-when-open, so a page load costs the four head-counts it already
 * paid for and nothing more: the rows are fetched the first time a card is
 * opened, and again whenever it is reopened.
 */
const VIEWS = {
  applicants: {
    title: "Applicants",
    blurb: "Everyone registered with CJLink.",
    empty: "No applicants registered yet.",
    noun: "applicant",
    table: "profiles",
    columns: ["Applicant", "Location", "Skills"],
  },
  applications: {
    title: "Applications",
    blurb: "Every application received, newest first.",
    empty: "No applications yet — this fills in as they arrive.",
    noun: "application",
    table: "applications",
    columns: ["Applicant", "Job", "Score", "Status", "Applied"],
  },
  interviews: {
    title: "Interviews",
    blurb: "Every interview scheduled at the CJTECH Shop.",
    empty: "No interviews scheduled yet.",
    noun: "interview",
    table: "interviews",
    columns: ["Applicant", "Job", "When", "Location", "Status"],
  },
  hired: {
    title: "Hired",
    blurb: "Applications that ended in an offer.",
    empty: "Nobody hired yet — this fills in as offers are made.",
    noun: "hire",
    table: "applications",
    columns: ["Applicant", "Job", "Score", "Status", "Applied"],
  },
};

export default function AdminRecords({ view, variant = "page", onClose }) {
  const meta = VIEWS[view] || VIEWS.applications;
  const isDropdown = variant === "dropdown";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setRows([]);

    async function load() {
      let query;
      if (view === "applicants") {
        query = supabase
          .from("profiles")
          .select("id, full_name, location, skills, created_at")
          .eq("role", "applicant")
          .order("created_at", { ascending: false });
      } else if (view === "interviews") {
        // interviews hangs off applications, which hangs off profiles and
        // jobs — one nested read rather than three round trips. Every embed
        // is a real foreign key (application_id, user_id, job_id), so
        // PostgREST resolves them without a hint.
        query = supabase
          .from("interviews")
          .select(
            "id, date, time, location, status, created_at, " +
              "applications(profiles(full_name), jobs(title, icon))"
          )
          .order("created_at", { ascending: false });
      } else {
        query = supabase
          .from("applications")
          .select("id, status, score, created_at, profiles(full_name), jobs(title, icon)")
          .order("created_at", { ascending: false });
        // The Hired card counts status = "hired", so the list must be the
        // same set — or the card would promise rows the page does not show.
        if (view === "hired") query = query.eq("status", "hired");
      }

      const { data, error: err } = await query;
      if (cancelled) return;
      if (err) setError(err.message);
      else setRows(data || []);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [view]);

  const noun = meta.noun;

  if (loading) {
    return (
      <div style={isDropdown ? dropdownPanel : panel}>
        <SkeletonLine width="180px" height="24px" />
        <div style={{ height: "14px" }} />
        <SkeletonCard lines={isDropdown ? 3 : 4} />
      </div>
    );
  }

  return (
    <div style={isDropdown ? dropdownPanel : panel}>
      <div style={headRow}>
        <div style={{ minWidth: 0 }}>
          <h2 style={isDropdown ? dropdownTitle : pageTitle}>{meta.title}</h2>
          <p style={isDropdown ? dropdownSub : pageSub}>
            {!error && `${rows.length} ${noun}${rows.length === 1 ? "" : "s"}`}
            {!error && ` · ${meta.blurb}`}
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={`Close ${meta.title}`} style={closeBtn}>
            ×
          </button>
        )}
      </div>

      {error && <p style={emptyText}>Could not load these right now: {error}</p>}
      {!error && rows.length === 0 && <p style={emptyText}>{meta.empty}</p>}

      {!error && rows.length > 0 && (
        <div style={tableWrap}>
          <table style={dashTable}>
            <thead>
              <tr>
                {meta.columns.map((c) => (
                  <th key={c} style={dashTh}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={dashRow}>
                  {view === "applicants" ? (
                    <>
                      <td style={dashTd}>
                        <span style={primary}>{row.full_name || "Unnamed"}</span>
                      </td>
                      <td style={dashTd}>{row.location || "No location"}</td>
                      <td style={dashTd}>
                        <span style={subtle}>{row.skills || "Not set"}</span>
                      </td>
                    </>
                  ) : view === "interviews" ? (
                    <>
                      <td style={dashTd}>
                        <span style={primary}>
                          {row.applications?.profiles?.full_name || "Unknown applicant"}
                        </span>
                      </td>
                      <td style={dashTd}>
                        <JobCell job={row.applications?.jobs} />
                      </td>
                      <td style={dashTd}>
                        <div style={primary}>{formatDateShort(row.date) || "No date"}</div>
                        {row.time && <div style={subtle}>{formatTime(row.time)}</div>}
                      </td>
                      <td style={dashTd}>{row.location || "To be confirmed"}</td>
                      <td style={dashTd}>
                        <span style={statusBadge(row.status)}>{statusLabel(row.status)}</span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={dashTd}>
                        <span style={primary}>{row.profiles?.full_name || "Unknown applicant"}</span>
                      </td>
                      <td style={dashTd}>
                        <JobCell job={row.jobs} />
                      </td>
                      <td style={dashTd}>
                        {row.score === null || row.score === undefined ? "—" : `${row.score}%`}
                      </td>
                      <td style={dashTd}>
                        <span style={statusBadge(row.status)}>{statusLabel(row.status)}</span>
                      </td>
                      <td style={dashTd}>{relativeTime(row.created_at)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Icon and title as siblings rather than one string, so the title is its own
 * piece of text — findable, selectable, and not "💻 IT Support" when you
 * searched for the job.
 */
function JobCell({ job }) {
  if (!job) return <span style={subtle}>Unknown job</span>;
  return (
    <>
      {job.icon && <span style={jobIcon} aria-hidden="true">{job.icon}</span>}
      <span style={{ color: "#fff" }}>{job.title}</span>
    </>
  );
}

const panel = { padding: "5px" };
const dropdownPanel = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  padding: "18px 18px 8px",
  marginBottom: "16px",
};
const headRow = { display: "flex", alignItems: "flex-start", gap: "12px" };
const pageTitle = { fontSize: "20px", color: "#fff", fontWeight: "800", margin: "0 0 4px" };
const pageSub = { fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "0 0 20px" };
const dropdownTitle = { fontSize: "15px", color: "#fff", fontWeight: "700", margin: "0 0 2px" };
const dropdownSub = { fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: "0 0 14px" };
const closeBtn = {
  marginLeft: "auto",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "8px",
  color: "rgba(255,255,255,0.7)",
  width: "28px",
  height: "28px",
  fontSize: "18px",
  lineHeight: "1",
  cursor: "pointer",
  flexShrink: 0,
};
const emptyText = { color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "32px 12px", margin: 0 };
const tableWrap = { overflowX: "auto" };
const primary = { color: "#fff", fontWeight: "600" };
const subtle = { color: "rgba(255,255,255,0.6)" };
const jobIcon = { marginRight: "6px" };
