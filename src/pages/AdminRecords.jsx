import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { dashTable, dashTh, dashTd, dashRow, statusBadge, statusLabel } from "../uiStyles";
import { SkeletonLine, SkeletonCard } from "../components/Skeleton";
import { formatDateShort, formatTime, relativeTime } from "../lib/format";

/**
 * The destination behind the dashboard's Applications, Interviews and Hired
 * cards.
 *
 * All three cards used to point at /admin/applicants — a skill-match ranking
 * page — so "Interviews: 4" led to a screen with no interviews on it. Each
 * number now leads to the rows it counted, on a route of its own.
 */
const VIEWS = {
  applications: {
    title: "Applications",
    blurb: "Every application received, newest first.",
    empty: "No applications yet — this fills in as they arrive.",
    from: "applications",
    columns: ["Applicant", "Job", "Score", "Status", "Applied"],
  },
  interviews: {
    title: "Interviews",
    blurb: "Every interview scheduled at the CJTECH Shop.",
    empty: "No interviews scheduled yet.",
    from: "interviews",
    columns: ["Applicant", "Job", "When", "Location", "Status"],
  },
  hired: {
    title: "Hired",
    blurb: "Applications that ended in an offer.",
    empty: "Nobody hired yet — this fills in as offers are made.",
    from: "applications",
    columns: ["Applicant", "Job", "Score", "Status", "Applied"],
  },
};

export default function AdminRecords({ view }) {
  const meta = VIEWS[view] || VIEWS.applications;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setRows([]);

    async function load() {
      // interviews hangs off applications, which hangs off profiles and jobs —
      // one nested read rather than three round trips. Every embed is a real
      // foreign key (application_id, user_id, job_id), so PostgREST resolves
      // them without a hint.
      let query;
      if (view === "interviews") {
        query = supabase
          .from("interviews")
          .select(
            "id, date, time, location, instructions, status, created_at, " +
              "applications(profiles(full_name), jobs(title, icon))"
          )
          .order("created_at", { ascending: false });
      } else {
        query = supabase
          .from("applications")
          .select("id, status, score, created_at, profiles(full_name), jobs(title, icon)")
          .order("created_at", { ascending: false });
        // The Hired card counts status = "hired", so the list must be the same
        // set — or the card would promise rows the page does not show.
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

  if (loading) {
    return (
      <div style={panel}>
        <SkeletonLine width="180px" height="24px" />
        <div style={{ height: "8px" }} />
        <SkeletonLine width="280px" height="13px" />
        <div style={{ height: "20px" }} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  return (
    <div style={panel}>
      <h2 style={pageTitle}>{meta.title}</h2>
      <p style={pageSub}>
        {error
          ? ""
          : `${rows.length} ${view === "interviews" ? "interview" : "application"}${rows.length === 1 ? "" : "s"}`}
        {!error && ` · ${meta.blurb}`}
      </p>

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
                  {view === "interviews" ? (
                    <>
                      <td style={dashTd}>
                        <span style={primary}>{row.applications?.profiles?.full_name || "Unknown applicant"}</span>
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
const pageTitle = { fontSize: "20px", color: "#fff", fontWeight: "800", margin: "0 0 4px" };
const pageSub = { fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "0 0 20px" };
const emptyText = { color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "40px 20px" };
const tableWrap = { overflowX: "auto" };
const primary = { color: "#fff", fontWeight: "600" };
const subtle = { color: "rgba(255,255,255,0.6)" };
const jobIcon = { marginRight: "6px" };
