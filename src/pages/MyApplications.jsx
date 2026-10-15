import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { radii, statusBadge, statusLabel, STATUS_COLORS } from "../uiStyles";
import { formatDate, formatDateShort, formatTime } from "../lib/format";
import { SkeletonCard } from "../components/Skeleton";
import SkillChips from "../components/SkillChips";

/**
 * The current interview for an application.
 *
 * Rescheduling inserts a NEW row rather than updating the old one, so an
 * application can accumulate several. The most recent one is the schedule the
 * admin last set, which is what the applicant needs to see; the others are
 * superseded. Falls back to id for rows with no created_at, since ids are
 * serial and always increase.
 */
const latestInterview = (app) => {
  const list = Array.isArray(app?.interviews) ? app.interviews : [];
  if (!list.length) return null;
  return [...list].sort(
    (a, b) =>
      new Date(b.created_at || 0) - new Date(a.created_at || 0) ||
      (b.id || 0) - (a.id || 0)
  )[0];
};

// statusLabel now comes from uiStyles, shared with the admin side.

export default function MyApplications() {
  const { user, profile } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);

  const fetchApplications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("applications")
      // interviews is embedded rather than fetched separately: one query, and
      // RLS ("Users can read own interviews") already scopes it to this
      // applicant's own rows. PostgREST applies that policy to the embed, so
      // someone else's schedule can never leak in here.
      .select("id, job_id, status, score, created_at, interviews(id, date, time, location, instructions, status, created_at), jobs(title, company, location, icon, description, salary, requirements)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setApplications(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from("applications").delete().eq("id", id);
      if (error) throw error;
      setConfirmingDelete(null);
      fetchApplications();
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }

  async function handleReapply(application) {
    try {
      const { error: updateErr } = await supabase
        .from("applications")
        .update({ status: "pending" })
        .eq("id", application.id);
      if (updateErr) throw updateErr;

      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: user.id,
        message: `You re-applied for ${application.jobs?.title}. The admin will review your application.`,
        type: "info",
      });
      if (notifErr) throw notifErr;

      fetchApplications();
    } catch (err) {
      alert("Failed to re-apply: " + err.message);
    }
  }

  // statusBadge now comes from uiStyles — this file had a fourth copy of the
  // same colour map, and this one was missing the `whiteSpace: nowrap` the
  // others had, so long statuses wrapped differently here than on the admin
  // side.

  /**
   * The progression, as human steps rather than raw column values.
   *
   * `interviewed` was missing from the old timeline, so an application that
   * had actually been interviewed rendered with the current marker sitting
   * on the step *before* it.
   *
   * No per-step sentence: six of them was six lines of prose standing
   * between the applicant and everything below, saying what the status panel
   * directly above already says once.
   */
  const PROGRESS_STEPS = [
    { key: "pending",             label: "Application Submitted" },
    { key: "reviewed",            label: "Under Review" },
    { key: "interview_scheduled", label: "Interview Scheduled" },
    { key: "interviewed",         label: "Interviewed" },
    { key: "accepted",            label: "Accepted" },
    { key: "hired",               label: "Hired" },
  ];

  const STATUS_ICON = {
    pending: "⏳", reviewed: "👀", interview_scheduled: "📅", interviewed: "🤝",
    accepted: "✅", hired: "🎉", rejected: "💔",
  };

  /** What the status *means*, in one sentence, rather than just its name. */
  const statusInfo = (status, hasInterview) => {
    switch (status) {
      case "reviewed":
        return { title: "Reviewed", body: "An employer has opened your application and is considering it." };
      case "interview_scheduled":
        // Only promise details that actually exist — this also covers a
        // status with no row, where there is nothing to point at yet.
        return hasInterview
          ? { title: "Interview Scheduled", body: "Your application moved on. The date, time and location are below." }
          : { title: "Interview Scheduled", body: "Your application moved on to the interview stage. A time will be confirmed with you." };
      case "interviewed":
        return { title: "Interviewed", body: "A decision is on the way — there is nothing you need to do." };
      case "accepted":
        return { title: "Accepted", body: "Congratulations, you were selected for this role." };
      case "hired":
        return { title: "Hired", body: "Congratulations, you are hired." };
      case "rejected":
        return { title: "Not Selected", body: "This employer moved ahead with other applicants. There are other jobs still open." };
      default:
        return { title: "Pending", body: "Your application is in the queue and has not been opened yet." };
    }
  };

  /**
   * The status, stated once and stated loudly.
   *
   * It used to appear four times: an 11px chip beside the job title, a
   * timeline of 10px labels, a second 11px chip in an "Application Status:"
   * row, and a plain sentence buried at the very bottom of the page underneath
   * the profile section. Four small things, none of them the thing you look at.
   */
  const StatusHero = ({ status, hasInterview, appliedOn }) => {
    const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
    const { title, body } = statusInfo(status, hasInterview);
    return (
      <div style={{ ...heroCard, borderColor: `${c.fg}40`, background: `linear-gradient(120deg, ${c.fg}2b, ${c.fg}0a)` }}>
        <span style={{ ...heroTile, backgroundColor: `${c.fg}26`, color: c.fg }}>
          {STATUS_ICON[status] || "•"}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...heroTitle, color: c.fg }}>{title}</div>
          <p style={heroBody}>{body}</p>
          <div style={heroMeta}>Applied {appliedOn}</div>
        </div>
      </div>
    );
  };

  /**
   * Horizontal: the whole ladder in one row, left to right.
   *
   * It used to be vertical — six rows of dot, label and a sentence each, the
   * better part of 400px of card for a progress bar, and most of what the
   * applicant had to scroll past to reach anything else. The three states are
   * kept (done, here, still to come), and the labels are still whole words
   * sitting under their own dots.
   *
   * Cells stop shrinking at 84px — the width at which "Application" and
   * "Scheduled" still fit on one line — so a narrower card scrolls the row
   * instead of breaking a word in half, and the row is scrolled to wherever
   * the applicant actually is so "Now" is never the part they cannot see.
   * The connector is drawn from each cell's centre back to the previous
   * one's, and a row that never wraps is a line that never breaks: the reason
   * the old horizontal version was abandoned still holds, it just no longer
   * forces the whole ladder to stand on end.
   */
  const StatusProgress = ({ status }) => {
    const currentIndex = PROGRESS_STEPS.findIndex((s) => s.key === status);
    const trackRef = useRef(null);

    useEffect(() => {
      const track = trackRef.current;
      const cell = track?.children[currentIndex];
      if (!cell) return;
      const target = cell.offsetLeft - (track.clientWidth - cell.offsetWidth) / 2;
      if (target > 0) track.scrollLeft = target;
    }, [currentIndex]);

    return (
      <ol style={progressTrack} ref={trackRef}>
        {PROGRESS_STEPS.map((step, i) => {
          const done = i < currentIndex;
          const current = i === currentIndex;
          const future = i > currentIndex;
          const accent = (STATUS_COLORS[step.key] || STATUS_COLORS.pending).fg;
          return (
            <li key={step.key} style={progressStep}>
              {i > 0 && (
                <span
                  style={{
                    ...progressLink,
                    backgroundColor:
                      i <= currentIndex
                        ? (STATUS_COLORS[PROGRESS_STEPS[i - 1].key] || STATUS_COLORS.pending).fg
                        : "rgba(255,255,255,0.12)",
                  }}
                />
              )}
              <span style={{
                ...progressDot,
                backgroundColor: done || current ? accent : "rgba(255,255,255,0.05)",
                border: done || current ? "none" : "2px solid rgba(255,255,255,0.16)",
                color: done || current ? "#0f172a" : "rgba(255,255,255,0.42)",
                boxShadow: current ? `0 0 0 4px ${accent}30` : "none",
              }}>
                {done ? "✓" : current ? "●" : i + 1}
              </span>
              <span style={{
                ...progressLabel,
                fontWeight: current ? "700" : "600",
                color: future ? "rgba(255,255,255,0.4)" : "#fff",
              }}>
                {step.label}
              </span>
              {current && (
                <span style={{ ...nowPill, backgroundColor: `${accent}26`, color: accent }}>Now</span>
              )}
            </li>
          );
        })}
      </ol>
    );
  };

  if (selectedApp) {
    const app = selectedApp;
    const job = app.jobs || {};
    const interview = latestInterview(app);
    return (
      <div style={container}>
        <button style={backBtn} onClick={() => setSelectedApp(null)}>
          ← Back to Applications
        </button>

        <div style={detailCard}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <span style={{ fontSize: "36px" }}>{job.icon || "💼"}</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: "18px", fontWeight: "800" }}>{job.title}</h3>
              <p style={{ margin: "2px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
                {job.company} • {job.location}
              </p>
            </div>
          </div>

          <StatusHero
            status={app.status}
            hasInterview={!!interview}
            appliedOn={new Date(app.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          />

          <h4 style={sectionHead}>Where you are</h4>
          {app.status === "rejected" ? (
            // No ladder to show: we do not record how far a rejected
            // application got, and a list of six things it did not reach
            // tells the applicant nothing they can use.
            <p style={rejectionNote}>
              This application has not moved on. Other jobs are still open — keep applying.
            </p>
          ) : (
            <StatusProgress status={app.status} />
          )}

          <h4 style={{ ...sectionHead, margin: "20px 0 12px" }}>About this role</h4>

          {/* Label over value, the shape the interview card already used.
              These were four `Salary: …` sentences of differing length, where
              a one-word field and a paragraph of description looked equally
              important and neither could be scanned. */}
          {job.salary && (
            <div style={fieldBlock}>
              <span style={fieldLabel}>Salary</span>
              <span style={salaryValue}>{job.salary}</span>
            </div>
          )}
          {job.description && (
            <div style={fieldBlock}>
              <span style={fieldLabel}>Description</span>
              <p style={fieldBody}>{job.description}</p>
            </div>
          )}
          {job.requirements && job.requirements.length > 0 && (
            <div style={fieldBlock}>
              <span style={fieldLabel}>Requirements</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "7px" }}>
                {job.requirements.map((r, i) => (
                  <span key={i} style={reqTag}>{r}</span>
                ))}
              </div>
            </div>
          )}

          <div style={divider} />

          {app.score && (
            <div style={fieldBlock}>
              <span style={fieldLabel}>Match Score</span>
              <span style={scoreValue}>{app.score}%</span>
            </div>
          )}

          {/* The whole point of this view for a scheduled applicant. The
              schedule was always written to `interviews` — it was simply never
              read back, so the only thing here was a line saying one existed. */}
          {interview ? (
            <div style={interviewCard}>
              <div style={interviewCardHead}>
                <span style={{ fontSize: "16px" }}>📅</span>
                <strong style={{ color: "#fff", fontSize: "14px" }}>Interview Schedule</strong>
                <span style={interviewPill}>
                  {String(interview.status || "scheduled").replace("_", " ")}
                </span>
              </div>

              <div style={interviewGrid}>
                <div style={interviewField}>
                  <span style={interviewLabel}>Date</span>
                  <span style={interviewValue}>{formatDate(interview.date)}</span>
                </div>
                <div style={interviewField}>
                  <span style={interviewLabel}>Time</span>
                  <span style={interviewValue}>{formatTime(interview.time)}</span>
                </div>
                <div style={interviewField}>
                  <span style={interviewLabel}>📍 Location</span>
                  <span style={interviewValue}>{interview.location || "To be confirmed"}</span>
                </div>
              </div>

              {interview.instructions && (
                <div style={interviewField}>
                  <span style={interviewLabel}>Instructions from the employer</span>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.75)", lineHeight: "1.55" }}>
                    {interview.instructions}
                  </p>
                </div>
              )}

              <p style={{ margin: "10px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>
                Please arrive on time. If you cannot make this slot, contact the employer.
              </p>
            </div>
          ) : app.status === "interview_scheduled" ? (
            // Status says scheduled but nothing came back — never present in
            // practice (the row is inserted before the status is set), but
            // silent absence would read as "no interview", so say something.
            <div style={{ ...infoMsg, display: "block", margin: "12px 0 0" }}>
              📅 An interview has been scheduled. Refresh the page to load the details.
            </div>
          ) : null}

          <div style={divider} />

          <h4 style={sectionHead}>Your Profile</h4>
          <div style={fieldBlock}>
            <span style={fieldLabel}>Skills</span>
            <div style={{ marginTop: "7px" }}>
              <SkillChips skills={profile?.skills} />
            </div>
          </div>
          <div style={fieldBlock}>
            <span style={fieldLabel}>Bio</span>
            <p style={{ ...fieldBody, ...(profile?.bio ? null : fieldEmpty) }}>
              {profile?.bio || "Not set"}
            </p>
          </div>
          {profile?.resume_url && (
            <div style={fieldBlock}>
              <span style={fieldLabel}>Resume</span>
              <div style={{ marginTop: "5px" }}>
                <a href={profile.resume_url} target="_blank" rel="noreferrer" style={resumeLink}>
                  📄 View Resume ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "5px" }}><SkeletonCard lines={2} /></div>;
  }

  return (
    <div style={container}>
      <h2 style={{ fontSize: "20px", color: "#fff", fontWeight: "800", margin: "0 0 4px" }}>My Applications</h2>
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "0 0 20px" }}>
        {applications.length} application{applications.length !== 1 ? "s" : ""} submitted
      </p>

      {applications.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <span style={{ fontSize: "48px", display: "block", marginBottom: "12px", opacity: 0.3 }}>📋</span>
          <p style={{ color: "rgba(255,255,255,0.6)", fontWeight: "500" }}>You haven't applied to any jobs yet.</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Browse jobs and submit your first application!</p>
        </div>
      ) : (
        <div style={grid}>
          {applications.map((app) => (
            <div key={app.id} style={card}>
              <div style={cardTop}>
                <span style={{ fontSize: "28px" }}>{app.jobs?.icon || "💼"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, color: "#fff", fontSize: "15px" }}>{app.jobs?.title}</h4>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                    {app.jobs?.company} • {app.jobs?.location}
                  </p>
                </div>
                <span style={statusBadge(app.status)}>{statusLabel(app.status)}</span>
              </div>
              <div style={cardBottom}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                  Applied: {new Date(app.created_at).toLocaleDateString()}
                </span>
                {app.interviews?.length > 0 && (
                  <span style={interviewChip}>
                    📅 Interview {formatDateShort(latestInterview(app).date)}
                  </span>
                )}
                {app.score && (
                  <span style={{
                    fontSize: "12px", fontWeight: "700", color: "#93c5fd",
                    background: "rgba(74,144,226,0.2)", padding: "2px 8px", borderRadius: "12px",
                  }}>
                    Score: {app.score}%
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button onClick={() => setSelectedApp(app)} style={viewBtn}>
                  👁️ View Details
                </button>
                {app.status === "rejected" && confirmingDelete === app.id ? (
                  <div style={{ display: "flex", gap: "8px", flex: 1 }}>
                    <button onClick={() => handleDelete(app.id)} style={deleteConfirmBtn}>Yes, Delete</button>
                    <button onClick={() => setConfirmingDelete(null)} style={cancelBtn}>Cancel</button>
                  </div>
                ) : app.status === "rejected" ? (
                  <>
                    <button onClick={() => handleReapply(app)} style={reapplyBtn}>🔄 Apply Again</button>
                    <button onClick={() => setConfirmingDelete(app.id)} style={deleteBtn}>🗑️</button>
                  </>
                ) : null}
              </div>
              {app.status === "hired" && (
                <div style={hiredMsg}>✅ You're hired for this position!</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const container = { padding: "5px" };
const grid = { display: "flex", flexDirection: "column", gap: "12px" };
const card = {
  backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.md, padding: "16px",
  border: "1px solid rgba(255,255,255,0.1)",
};
const cardTop = { display: "flex", alignItems: "center", gap: "14px" };
const cardBottom = { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.08)" };
const backBtn = { background: "none", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: "13px", fontWeight: "600", padding: 0, marginBottom: "16px" };
const detailCard = {
  backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.lg, padding: "24px",
  border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)",
};
const divider = { height: "1px", backgroundColor: "rgba(255,255,255,0.08)", margin: "16px 0" };

const sectionHead = { color: "#fff", fontSize: "14px", fontWeight: "700", margin: "0 0 12px" };

/**
 * One field, one look: a small uppercase name, then its value.
 *
 * Every block on this screen now reads on the same rhythm — salary,
 * description, requirements, match score, skills, bio — instead of being a
 * run of `Salary: …` sentences whose weight depended on how long the value
 * happened to be.
 */
const fieldBlock = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: radii.md, padding: "11px 14px", marginBottom: "10px",
};
const fieldLabel = {
  display: "block", fontSize: "10px", fontWeight: "700", letterSpacing: "0.06em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.45)",
};
const fieldValue = {
  display: "block", fontSize: "14px", fontWeight: "700", color: "#fff",
  marginTop: "3px", lineHeight: "1.4",
};
const fieldBody = {
  margin: "5px 0 0", fontSize: "13px", lineHeight: "1.65",
  color: "rgba(255,255,255,0.78)", whiteSpace: "pre-wrap",
};
const fieldEmpty = { color: "rgba(255,255,255,0.38)", fontStyle: "italic" };
// The number the applicant scans for, given the room a 14px value does not.
const salaryValue = { ...fieldValue, fontSize: "17px", marginTop: "5px", letterSpacing: "-0.01em" };
const scoreValue = { ...fieldValue, fontSize: "16px", color: "#93c5fd" };

// The status panel. Deliberately the largest thing on the detail card — it
// is the question the applicant opened this screen to ask.
const heroCard = {
  display: "flex", alignItems: "flex-start", gap: "14px", flexWrap: "wrap",
  padding: "18px 20px", borderRadius: radii.lg, marginBottom: "20px",
  border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};
const heroTile = {
  width: "44px", height: "44px", borderRadius: "13px", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "21px",
};
const heroTitle = { fontSize: "20px", fontWeight: "800", lineHeight: "1.2", letterSpacing: "-0.01em" };
const heroBody = { margin: "5px 0 0", fontSize: "14px", lineHeight: "1.5", color: "rgba(255,255,255,0.82)" };
const heroMeta = { marginTop: "7px", fontSize: "12px", color: "rgba(255,255,255,0.45)" };

const rejectionNote = {
  margin: "0 0 18px", fontSize: "13px", lineHeight: "1.55", color: "rgba(255,255,255,0.6)",
};

// Horizontal so the ladder is one row instead of six. Equal cells, the dot
// centred in each, and a connector from this cell's centre back to the
// previous one's (`left: -50%` is one cell to the left) — so it lands exactly
// on the dot whatever the label underneath wraps to.
const progressTrack = {
  display: "flex", alignItems: "flex-start", listStyle: "none",
  // The bottom padding is a gutter for the scrollbar: it is drawn inside the
  // padding box, and it must not land on top of the last line of a label.
  margin: "0 0 18px", padding: "4px 6px 16px",
  overflowX: "auto", overflowY: "hidden", scrollbarWidth: "thin",
};
const progressStep = {
  position: "relative", flex: "1 0 84px", minWidth: "84px",
  display: "flex", flexDirection: "column", alignItems: "center",
  textAlign: "center", paddingTop: "4px",
};
const progressLink = {
  position: "absolute", top: "16px", left: "-50%", width: "100%",
  height: "2px", borderRadius: "2px",
};
const progressDot = {
  position: "relative", zIndex: 1, width: "26px", height: "26px", borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "12px", fontWeight: "800", boxSizing: "border-box",
  transition: "background-color 0.2s, box-shadow 0.2s",
};
const progressLabel = {
  display: "block", width: "100%", marginTop: "8px",
  fontSize: "11px", lineHeight: "1.35", overflowWrap: "break-word",
};
const nowPill = {
  fontSize: "10px", fontWeight: "800", letterSpacing: "0.06em", textTransform: "uppercase",
  padding: "2px 7px", borderRadius: "20px", flexShrink: 0, marginTop: "7px",
};
const reqTag = {
  fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
  backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", fontWeight: "500",
};
const resumeLink = { color: "#93c5fd", fontSize: "13px", fontWeight: "600", textDecoration: "none" };
const infoMsg = { fontSize: "13px", fontWeight: "600", color: "#fbbf24" };

// Interview schedule block in the application detail view. Deliberately the
// strongest surface on the page — for a scheduled applicant this is the only
// thing they actually opened the page to read.
const interviewCard = {
  marginTop: "16px", padding: "16px", borderRadius: "10px",
  backgroundColor: "rgba(139,92,246,0.12)",
  border: "1px solid rgba(139,92,246,0.35)",
};
const interviewCardHead = {
  display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px",
};
const interviewPill = {
  marginLeft: "auto", fontSize: "10px", fontWeight: "700", padding: "3px 8px",
  borderRadius: "20px", textTransform: "capitalize",
  backgroundColor: "rgba(255,255,255,0.1)", color: "#c4b5fd",
};
const interviewGrid = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "12px",
};
const interviewField = { minWidth: 0 };
// Same label-over-value shape as every other field on this screen; named at
// their call sites because inside this card they describe an appointment.
const interviewLabel = fieldLabel;
const interviewValue = fieldValue;
const interviewChip = {
  fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "12px",
  backgroundColor: "rgba(139,92,246,0.2)", color: "#c4b5fd", whiteSpace: "nowrap",
};
const viewBtn = {
  flex: 1, padding: "8px", fontSize: "12px", fontWeight: "700",
  background: "rgba(74,144,226,0.2)", color: "#93c5fd", border: "1px solid rgba(74,144,226,0.3)",
  borderRadius: "8px", cursor: "pointer",
};
const reapplyBtn = {
  flex: 1, padding: "8px", fontSize: "12px", fontWeight: "700",
  background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none",
  borderRadius: "8px", cursor: "pointer", boxShadow: "0 4px 16px rgba(26,115,232,0.3)",
};
const deleteBtn = {
  padding: "8px 12px", fontSize: "12px", fontWeight: "700",
  background: "rgba(239,68,68,0.2)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: "8px", cursor: "pointer",
};
const deleteConfirmBtn = {
  flex: 1, padding: "8px 14px", fontSize: "12px", fontWeight: "700",
  background: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer",
};
const cancelBtn = {
  padding: "8px 14px", fontSize: "12px", fontWeight: "600",
  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "8px", cursor: "pointer",
};
const hiredMsg = {
  marginTop: "10px", fontSize: "12px", color: "#86efac",
  fontWeight: "600", textAlign: "center",
};
