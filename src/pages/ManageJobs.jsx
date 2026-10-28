import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { colors, radii, dashTable, dashTh, dashTd, dashRow, dashGrid, statusBadge, statusLabel } from "../uiStyles";
import { SkeletonTable } from "../components/Skeleton";
import { aiSkillMatch } from "../lib/aiSkillMatch";
import { runInParallel, selectQuickScan, DEFAULT_CONCURRENCY, QUICK_SCAN_COUNT } from "../lib/batchMatch";
import { relativeTime, formatDate, formatTime } from "../lib/format";
import ApplicantSelection, { AnalyzeSelectedButton } from "../components/ApplicantSelection";
import SkillChips from "../components/SkillChips";
import SkillPicker from "../components/SkillPicker";
import { loadSkillCatalog } from "../lib/skillCatalog";

/**
 * CJLink has one location: the CJTECH Shop.
 *
 * This used to be a required dropdown offering Shop / Office / Business
 * Address. Three of those four options could never be the answer, and the
 * fourth — the empty "Select location" — was a required field whose omission
 * stalled scheduling with no visible error. A select that offers a single
 * real choice is not a choice, so the location is stated and filled in
 * automatically. Change this constant and the modal follows; the interviews
 * table stays TEXT so nothing in the database needs touching.
 */
const INTERVIEW_LOCATION = "CJTECH Shop";

// statusBadge / statusLabel / STATUS_COLORS now come from uiStyles: the admin
// dashboard renders the same chips, and a second copy would be a third place
// for them to drift apart.

export default function ManageJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [viewingJob, setViewingJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0, name: "" });

  // Applicants as fetched, BEFORE any AI call. Opening a job no longer starts
  // the scan by itself — the employer ticks who is worth a Gemini call, or
  // takes the whole roster from the panel below, so the roster has to exist
  // independently of `applicants` (which only ever holds analysed people,
  // because the cards read `a.match.score` and would crash on an unscanned
  // row).
  const [roster, setRoster] = useState([]);
  const [scanDone, setScanDone] = useState(false);
  // "quick" | "all" | "selected" | null — the scope last run, so a refresh
  // after a status update can reuse the answers instead of paying for the
  // scan again.
  const [scanMode, setScanMode] = useState(null);

  // The employer's hand-picked subset. A plain id array rather than a Set so
  // it can go straight into state (Sets are compared by identity, which would
  // re-render the picker on every unrelated change).
  const [selectedIds, setSelectedIds] = useState([]);

  // Who the last scan actually charged quota for. Kept in a ref rather than
  // derived from state because a re-fetch after a status change has to rebuild
  // the same target list from a FRESH roster whose ids may have shifted.
  const scannedIdsRef = useRef([]);

  // The interview booked for each of this job's applications, keyed by
  // application_id. This table used to be write-only here: booking an
  // appointment only flipped a status badge, so the date and time you had just
  // set were invisible until you left the page and opened Records.
  const [interviews, setInterviews] = useState({});

  // Bumped to invalidate a scan that is still in flight (job switched away,
  // user hit Cancel, component unmounted). Every await re-checks it, so a
  // stale run can never write into a view that has moved on — which is exactly
  // the race the old serial loop had.
  const runIdRef = useRef(0);

  // The shared skills catalog. Requirements are picked from it rather than
  // typed free-hand, because applicants build their own skill list from what
  // jobs require — so an admin's typo used to become a permanent option for
  // every applicant, and "Good communication" scored 0% against a profile
  // that listed "Communication Skills".
  const [skillCatalog, setSkillCatalog] = useState(null);

  const [form, setForm] = useState({
    title: "",
    company: "CJTECH Computer Trading",
    location: "Sangi, Toledo City",
    salary: "",
    description: "",
    // Already an array — the picker writes one, so the old split(",") on
    // save is gone.
    requirements: [],
    icon: "💼",
    max_applicants: 0,
    // New jobs publish immediately, matching the pre-status behaviour.
    status: "published",
  });

  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewForm, setInterviewForm] = useState({ application_id: null, date: "", time: "", instructions: "" });
  // The applicant the interview is for. The modal used to keep only the
  // application id, so the admin was setting a date and time for a row of
  // data with nothing on screen saying which person that was — easy to
  // schedule the right slot against the wrong applicant.
  const [interviewApplicant, setInterviewApplicant] = useState(null);

  const fetchJobs = async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (data) setJobs(data);
    setLoading(false);
  };

  /**
   * @param {number} jobId
   * @param {"quick"|"all"|"selected"|null} scope  What the employer ran last on
   *   this job. Defaults to the current scope, which is what a re-fetch after a
   *   status change wants; `viewApplicants` passes null explicitly so opening a
   *   different job starts at the picker instead of silently re-scanning.
   */
  const fetchApplicantsForJob = async (jobId, scope = scanMode) => {
    const { data: apps } = await supabase
      .from("applications")
      .select("id, user_id, status, score, created_at")
      .eq("job_id", jobId);

    if (!apps || apps.length === 0) {
      runIdRef.current += 1;
      setAnalyzing(false);
      setRoster([]);
      setApplicants([]);
      setScanDone(false);
      setScanMode(null);
      setInterviews({});
      return;
    }

    // Read the appointments back alongside the applications. Done before any
    // early return, so a re-fetch after a status change refreshes it too —
    // scheduling an interview has to show up on the detail card immediately.
    const { data: ivRows } = await supabase
      .from("interviews")
      .select("id, application_id, date, time, location, instructions, status")
      .in("application_id", apps.map((a) => a.id));
    const byApplication = {};
    (ivRows || []).forEach((iv) => {
      if (iv && iv.application_id) byApplication[iv.application_id] = iv;
    });
    setInterviews(byApplication);

    const userIds = apps.map((a) => a.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, skills, location, phone_number, resume_url, bio")
      .in("id", userIds);

    // Email is not a profiles column — auth.users is never readable from the
    // browser, so this admin-gated SECURITY DEFINER function is the only
    // client-side path to it. It is the same call Manage Users already
    // makes; if it ever fails, the applicant just shows no address.
    const { data: emailRows } = await supabase.rpc("get_profiles_with_email");
    const emails = {};
    (emailRows || []).forEach((r) => {
      if (r && r.id) emails[r.id] = r.email;
    });

    // Everything the cards need except the AI answer — the match is what costs
    // quota, and it now only happens when the employer asks for it.
    const built = (profiles || []).map((p) => ({
      ...p,
      email: emails[p.id] || "",
      application: apps.find((a) => a.user_id === p.id),
    }));

    setRoster(built);
    setAnalyzeProgress({ current: 0, total: 0, name: "" });

    if (!scope) {
      // First time on this job: show the picker and spend nothing. The ticks
      // belong to the job that produced them, so a stale selection must not
      // survive into the next one — it would silently decide who gets charged.
      runIdRef.current += 1;
      setAnalyzing(false);
      setApplicants([]);
      setScanDone(false);
      setSelectedIds([]);
      return;
    }

    // This is a re-fetch after a status change or a scheduled interview. The
    // AI's answers have not changed, so carry them over instead of paying for
    // the whole scan again — scheduling an interview must not drag the admin
    // back through a spinner.
    const previous = new Map(applicants.map((p) => [p.id, p.match]));
    const carried = built
      .filter((p) => previous.has(p.id))
      .map((p) => ({ ...p, match: previous.get(p.id) }));
    const stillValid =
      scope === "all" ? carried.length === built.length : carried.length === previous.size;

    if (stillValid && carried.length > 0) {
      setApplicants(carried.sort((a, b) => b.match.score - a.match.score));
      setScanDone(true);
      setAnalyzing(false);
      return;
    }

    // Someone new applied, or there are no answers to carry: re-run the same
    // scope against the fresh roster.
    //
    // A hand-picked run has to be re-picked, not replayed against everyone —
    // `built` is the WHOLE fresh roster, and running it as-is would silently
    // bill quota for people the employer never ticked.
    if (scope === "selected") {
      const wanted = built.filter((p) => scannedIdsRef.current.includes(p.id));
      if (wanted.length === 0) {
        // Everyone in the last batch is gone: back to the picker rather than
        // burning a call that cannot answer anything.
        runIdRef.current += 1;
        setAnalyzing(false);
        setApplicants([]);
        setScanDone(false);
        return;
      }
      runScan("selected", wanted);
      return;
    }

    runScan(scope, built);
  };

  const cancelScan = () => {
    // Invalidates the in-flight run: its lanes stop picking up new work and
    // its results are never committed.
    runIdRef.current += 1;
    setAnalyzing(false);
  };

  /**
   * Run the AI scan over a chosen scope.
   *
   * @param {"quick"|"all"|"selected"} mode
   *   quick    = the top QUICK_SCAN_COUNT people by the free local pre-rank.
   *   all      = the whole roster.
   *   selected = exactly the ids the employer ticked. The caller passes the
   *              already-filtered list as `people`; this mode never widens it.
   * @param {Array} people        Defaults to state. Passed explicitly when a
   *                              refresh has just built a new roster whose
   *                              state copy has not landed yet, and always for
   *                              a "selected" run.
   */
  const runScan = async (mode, people = roster) => {
    const requirements = viewingJob?.requirements || [];
    const title = viewingJob?.title || "";

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const cancelled = () => runIdRef.current !== runId;

    // Quick Scan picks its targets with the local matcher first — free, and it
    // means quota goes to plausible matches rather than a blind pass over
    // everyone. "selected" skips it: the employer has already done the picking
    // by hand, and re-ranking their choice would be a second, unasked-for
    // filter on top of it.
    const targets = mode === "quick" ? await selectQuickScan(people, requirements) : people;
    if (cancelled()) return;

    // Remember who this run was for, so a re-fetch after a status change can
    // rebuild the same target list from a fresh roster.
    scannedIdsRef.current = targets.map((t) => t.id);

    setAnalyzing(true);
    setScanMode(mode);
    setAnalyzeProgress({ current: 0, total: targets.length, name: "" });

    const analyzed = [];
    try {
      await runInParallel(
        targets,
        (person) => aiSkillMatch(person.skills, requirements, title),
        {
          concurrency: DEFAULT_CONCURRENCY,
          isCancelled: cancelled,
          onResult: (match, index, completed, total) => {
            if (cancelled()) return;
            analyzed.push({ person: targets[index], match });
            setAnalyzeProgress({
              current: completed,
              total,
              name: targets[index].full_name || "Unnamed",
            });
          },
        }
      );
    } finally {
      if (!cancelled()) {
        // ONE commit, ONE sort, whatever the scope. `runInParallel` already ran
        // the calls in a fixed pool of DEFAULT_CONCURRENCY lanes, so the work
        // overlapped without the UI ever being asked to paint an intermediate
        // ranking. Sorting per result would have produced n orderings nobody
        // could see: n sorts and n full re-renders of the whole card grid,
        // behind an overlay that was covering the grid the entire time.
        setApplicants(
          analyzed
            .map((entry) => ({ ...entry.person, match: entry.match }))
            .sort((a, b) => b.match.score - a.match.score)
        );
        setScanDone(true);
        setAnalyzing(false);
      }
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSkillCatalog().then((catalog) => {
      if (!cancelled) setSkillCatalog(catalog);
    });
    return () => { cancelled = true; };
  }, []);

  // Admin escape hatch: a skill the catalog does not have yet can still be
  // used, rather than holding a posting hostage to a missing entry. It is
  // written to the catalog too, so the next applicant can pick it.
  async function handleCreateCustomSkill(name) {
    if (!name || form.requirements.includes(name)) return;
    setForm((f) => ({ ...f, requirements: [...f.requirements, name] }));
    const { error } = await supabase
      .from("skills")
      .insert({ name, category: "General", aliases: [] });
    // 23505 is a unique violation — someone already added it. Not worth
    // shouting about; the skill is on the posting either way.
    if (error && error.code !== "23505") {
      setMessage(`"${name}" was added to this job but could not be saved to the skill list: ${error.message}`);
    }
  }

  // Closing replaces deleting. applications.job_id is ON DELETE CASCADE, so
  // deleting a job erased every application, score and interview against it —
  // and there was no way to take a posting down without doing that. A closed
  // job stops being advertised and keeps its history.
  async function handleToggleStatus(job) {
    const closing = job.status !== "closed";
    const { error } = await supabase
      .from("jobs")
      .update({ status: closing ? "closed" : "published" })
      .eq("id", job.id);
    if (error) {
      setMessage(`Could not ${closing ? "close" : "reopen"} "${job.title}": ${error.message}`);
    } else {
      setMessage(`"${job.title}" ${closing ? "closed" : "reopened"}.`);
      fetchJobs();
    }
  }

  // Extracted so openEdit can spread it — adding a field later cannot leave
  // the two out of step.
  function emptyForm() {
    return {
      title: "",
      company: "CJTECH Computer Trading",
      location: "Sangi, Toledo City",
      salary: "",
      description: "",
      requirements: [],
      icon: "💼",
      max_applicants: 0,
      status: "published",
    };
  }

  function resetForm() {
    setForm(emptyForm());
    setEditing(null);
    setShowForm(false);
  }

  function openEdit(job) {
    setForm({
      ...emptyForm(),
      title: job.title || "",
      company: job.company || "CJTECH Computer Trading",
      location: job.location || "Sangi, Toledo City",
      salary: job.salary || "",
      description: job.description || "",
      // Already an array, straight from the picker.
      requirements: (job.requirements || []).filter(Boolean),
      icon: job.icon || "💼",
      max_applicants: job.max_applicants || 0,
      // A row created before the status migration simply has no column.
      status: job.status || "published",
    });
    setEditing(job.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setMessage("A job title is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      ...form,
      title: form.title.trim(),
      // Array as stored. The old `split(",")` is gone — the picker hands back
      // one entry per skill, so a requirement can no longer be broken apart
      // mid-phrase by a comma inside it.
      requirements: [...new Set(form.requirements.map((s) => s.trim()).filter(Boolean))],
    };

    if (editing) {
      const { error } = await supabase.from("jobs").update(payload).eq("id", editing);
      if (error) { setMessage("Failed to update: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("jobs").insert(payload);
      if (error) { setMessage("Failed to create: " + error.message); setSaving(false); return; }
    }

    setMessage(editing ? "Job updated successfully!" : "Job created successfully!");
    resetForm();
    fetchJobs();
    setSaving(false);
  }

  function viewApplicants(job) {
    setViewingJob(job);
    setSelectedApplicant(null);
    setScanMode(null);
    // The selection belongs to the job that produced the roster; a stale tick
    // against the next job's applicants would silently decide who gets charged
    // for it.
    setSelectedIds([]);
    scannedIdsRef.current = [];
    fetchApplicantsForJob(job.id, null);
  }

  async function updateApplicantStatus(applicationId, newStatus) {
    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", applicationId);
    if (!error) {
      setSelectedApplicant(null);
      fetchApplicantsForJob(viewingJob.id);
    }
  }

  function openInterviewModal(applicant) {
    setInterviewForm((f) => ({ ...f, application_id: applicant.application.id }));
    setInterviewApplicant(applicant);
    setShowInterviewModal(true);
  }

  function closeInterviewModal() {
    setShowInterviewModal(false);
    setInterviewApplicant(null);
    setInterviewForm({ application_id: null, date: "", time: "", instructions: "" });
  }

  async function handleScheduleInterview() {
    const { application_id, date, time, instructions } = interviewForm;

    // Both exits from this function used to be silent: a missing field simply
    // returned, and a failed insert fell through the `if (!error)` with no
    // message at all. The button did nothing, with no way to tell why.
    //
    // Location is deliberately absent from this check. It is not something
    // the admin enters — there is one location and it is filled in below.
    if (!date || !time) {
      setMessage("Pick a date and a time before scheduling.");
      return;
    }

    const { error } = await supabase.from("interviews").insert({
      application_id,
      date,
      time,
      location: INTERVIEW_LOCATION,
      instructions,
      status: "scheduled",
    });
    if (error) {
      setMessage("Could not schedule the interview: " + error.message);
      return;
    }

    // The interview row already exists at this point, so a failure here must
    // not read as "nothing happened".
    const { error: statusError } = await supabase
      .from("applications")
      .update({ status: "interview_scheduled" })
      .eq("id", application_id);

    if (statusError) {
      setMessage(
        "Interview scheduled, but " + (interviewApplicant?.full_name || "the applicant") +
        "'s status could not be updated: " + statusError.message
      );
    } else {
      setMessage("Interview scheduled for " + (interviewApplicant?.full_name || "the applicant") + ".");
    }

    closeInterviewModal();
    fetchApplicantsForJob(viewingJob.id);
  }

  const msg = (text) => {
    const ok = text.includes("success") || text.includes("updated") || text.includes("deleted") || text.includes("created") || text.includes("closed") || text.includes("reopened");
    return {
      padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "600",
      backgroundColor: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
      color: ok ? colors.success : colors.danger, textAlign: "center",
    };
  };

  if (viewingJob && !selectedApplicant) {
    const job = viewingJob;
    return (
      <div style={container}>
        <button
          style={backBtn}
          onClick={() => {
            // Leaving the job also invalidates a scan still in flight.
            runIdRef.current += 1;
            setAnalyzing(false);
            setViewingJob(null);
            setApplicants([]);
            setRoster([]);
            setScanDone(false);
            setScanMode(null);
          }}
        >
          ← Back to Jobs
        </button>

        <h2 style={{ fontSize: "20px", color: "#fff", fontWeight: "800", margin: "16px 0 4px" }}>
          {job.icon} {job.title}
        </h2>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "0 0 4px" }}>
          {job.company} • {job.location}
        </p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>
          Requirements: {job.requirements?.join(", ") || "None"}
        </p>

        {/* Quick Scan only ranks a slice, so say so — otherwise "5 applicants"
            reads as "this job only got 5 applicants". The button re-runs the
            full roster without losing what has already been found. */}
        {!analyzing && scanDone && scanMode === "quick" && applicants.length < roster.length && (
          <div style={scanNote}>
            ⚡ Quick scan ranked the top {applicants.length} of {roster.length} applicants.{" "}
            <button style={scanLink} onClick={() => runScan("all")}>
              Scan all {roster.length} →
            </button>
          </div>
        )}

        {analyzing ? (
          <div style={analyzingOverlay}>
            <div style={analyzingContent}>
              <span style={{ fontSize: "40px" }}>🧠</span>
              <p style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: "12px 0 4px" }}>
                AI Analyzing Applicants
              </p>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                {scanMode === "quick"
                  ? `Quick scan — top ${QUICK_SCAN_COUNT} by local skill match, run ${DEFAULT_CONCURRENCY} at a time.`
                  : `Gemini comparing skills against job requirements, ${DEFAULT_CONCURRENCY} at a time.`}
              </p>
              <div style={progressWrap}>
                <div style={progressTrack}>
                  <div
                    style={{
                      ...progressFill,
                      width: `${(analyzeProgress.total ? analyzeProgress.current / analyzeProgress.total : 0) * 100}%`,
                    }}
                  />
                </div>
                <span style={progressText}>
                  {analyzeProgress.current}/{analyzeProgress.total} — {analyzeProgress.name}
                </span>
              </div>
              {/* A hung call used to pin this overlay open with no way out;
                  aiSkillMatch now times out, and this cancels the batch. */}
              <button style={cancelScanBtn} onClick={cancelScan}>
                Cancel
              </button>
            </div>
          </div>
        ) : roster.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "40px" }}>
            No applicants for this job yet.
          </p>
        ) : !scanDone ? (
          /* The picker, with Quick scan and Scan all sitting in the same
             decision band as Analyze Selected. This is the only place
             checkboxes live — the roster and the results grid never render
             side by side, so a click on a result card can never be confused
             with a click on a checkbox. */
          <ApplicantSelection
            items={roster}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            onAnalyze={() =>
              runScan("selected", roster.filter((p) => selectedIds.includes(p.id)))
            }
            onQuickScan={() => runScan("quick")}
            quickScanLabel={`⚡ Quick scan — top ${Math.min(QUICK_SCAN_COUNT, roster.length)}`}
            onScanAll={() => runScan("all")}
            title={`Choose applicants to score against ${job.title}`}
            subtitle="Tick the people worth a Gemini call. Quick scan pre-ranks the whole list with the free local matcher; Scan all sends every one of them."
          />
        ) : (
          <>
            <div style={resultsHead}>
              <span style={resultsTitle}>Analyzed results</span>
              <span style={resultsMeta}>{scanSummary(applicants.length, roster.length, scanMode)}</span>
            </div>
            <div style={resultsToolbar}>
              <AnalyzeSelectedButton
                count={selectedIds.length}
                onClick={() =>
                  runScan("selected", roster.filter((p) => selectedIds.includes(p.id)))
                }
              />
              {/* Stepping back to the picker must not cost the answers already
                  on screen: `applicants` stays in state, and the next
                  "Analyze Selected" simply replaces it with one commit. */}
              <button style={resultsLink} onClick={() => setScanDone(false)}>
                ← Change selection
              </button>
            </div>
            <div style={dashGrid}>
            {applicants.map((a) => (
              <div key={a.id} style={candidateCard} onClick={() => setSelectedApplicant(a)}>
                <div style={candidateHeader}>
                  <div style={avatarCircle}>{a.full_name?.[0] || "?"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", color: "#fff", fontSize: "14px" }}>
                      {a.full_name || "Unnamed"}
                    </div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "5px" }}>
                      {a.location || "No location"}
                    </div>
                    {/* The list carried no status whatsoever, so scheduling
                        an interview left nothing on screen to show for it —
                        you had to open each applicant to find out. */}
                    <span style={statusBadge(a.application?.status || "pending")}>
                      {statusLabel(a.application?.status)}
                    </span>
                  </div>
                  <div style={scoreCircle(a.match.score)}>{a.match.score}%</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                  <span style={aiBadge}>AI</span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                    {a.match.basicScore !== undefined && a.match.basicScore !== a.match.score
                      ? `Basic ${a.match.basicScore}% → ${a.match.score}%`
                      : "AI Skill Match"}
                  </span>
                </div>
                <div style={matchBarOuter}>
                  <div style={matchBarInner(a.match.score)} />
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "8px" }}>
                  Matched {a.match.matched}/{a.match.total} requirements
                </div>
                <div style={{ fontSize: "11px", marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {a.match.matchedItems.slice(0, 3).map((s) => (
                    <span key={s} style={matchTag}>✅ {s}</span>
                  ))}
                  {a.match.matchedItems.length > 3 && (
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>+{a.match.matchedItems.length - 3} more</span>
                  )}
                </div>
              </div>
            ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Built ABOVE the `selectedApplicant` early return, not inside either
  // return path. The modal used to sit in the main return, which that early
  // return skips — so the only view containing a "Schedule Interview" button
  // was the one place the modal could never render. Clicking the button set
  // showInterviewModal and nothing appeared. Referencing it from both paths
  // is what makes it reachable.
  const interviewModal = showInterviewModal && (
    <div style={formOverlay}>
      <div style={formModal}>
        <div style={formHeader}>
          <h3 style={{ margin: 0, color: "#fff" }}>Schedule Interview</h3>
          <button onClick={closeInterviewModal} style={closeBtn}>✕</button>
        </div>
        <div style={formBody}>
          {/* Who this interview is for. Before this the modal showed only
              date, time and location — nothing on screen identified the
              person, so the only way to be sure you were scheduling the
              right applicant was to look back at the list behind it. */}
          {interviewApplicant && (
            <div style={applicantBanner}>
              <div style={applicantBannerTop}>
                <span style={applicantAvatar}>
                  {(interviewApplicant.full_name || "?").trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={applicantBannerName}>
                    {interviewApplicant.full_name || "Unnamed applicant"}
                  </div>
                  <div style={applicantBannerMeta}>
                    {viewingJob?.title || "this job"}
                    {interviewApplicant.location ? " · " + interviewApplicant.location : ""}
                  </div>
                </div>
                {typeof interviewApplicant.match?.score === "number" && (
                  <span style={applicantMatchBadge}>{interviewApplicant.match.score}% match</span>
                )}
              </div>
              {interviewApplicant.phone_number && (
                <div style={applicantBannerLine}>📞 {interviewApplicant.phone_number}</div>
              )}
              {interviewApplicant.application?.status && (
                <div style={applicantBannerLine}>
                  Application: {statusLabel(interviewApplicant.application.status)}
                </div>
              )}
            </div>
          )}

          <div style={fieldGroup}>
            <label style={label} htmlFor="iv-date">Date *</label>
            <input id="iv-date" style={input} type="date" value={interviewForm.date}
              onChange={(e) => setInterviewForm({ ...interviewForm, date: e.target.value })} />
          </div>
          <div style={fieldGroup}>
            <label style={label} htmlFor="iv-time">Time *</label>
            <input id="iv-time" style={input} type="time" value={interviewForm.time}
              onChange={(e) => setInterviewForm({ ...interviewForm, time: e.target.value })} />
          </div>
          {/* One location, so no dropdown. A select offering a single real
              answer only asks the admin to restate what is already true —
              and this one was required, so leaving it blank stalled
              scheduling with nothing on screen saying why. Stated here, and
              written to the interview automatically. */}
          <div style={locationRow}>
            <span style={locationPin} aria-hidden="true">📍</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={locationRowLabel}>Location</span>
              <span style={locationRowValue}>{INTERVIEW_LOCATION}</span>
            </div>
          </div>
          <div style={fieldGroup}>
            <label style={label}>Instructions</label>
            <textarea style={{ ...input, minHeight: "60px" }} value={interviewForm.instructions}
              onChange={(e) => setInterviewForm({ ...interviewForm, instructions: e.target.value })}
              placeholder="Any additional instructions for the applicant..." />
          </div>
        </div>
        <div style={formFooter}>
          <button onClick={closeInterviewModal} style={cancelBtn}>Cancel</button>
          <button onClick={handleScheduleInterview} style={saveBtn}>Schedule</button>
        </div>
      </div>
    </div>
  );

  if (selectedApplicant) {
    const a = selectedApplicant;
    const matchScore = a.match?.score || 0;
    const matchTotal = a.match?.total || 0;
    const matched = a.match?.matchedItems || [];
    const missing = a.match?.missingItems || [];
    // The appointment booked against this application, if there is one.
    const iv = interviews[a.application?.id];
    // Both lists hold JOB requirements, not the applicant's own skills, so
    // together they are the full checklist — which is what turns "he has
    // Excel" into an answerable "why does he fit this job".
    const checklist = [
      ...matched.map((s) => ({ name: s, has: true })),
      ...missing.map((s) => ({ name: s, has: false })),
    ];

    return (
      <div style={container}>
        {interviewModal}

        <button style={backBtn} onClick={() => setSelectedApplicant(null)}>
          ← Back to applicants
        </button>

        {/* Feedback for actions taken from THIS view. The message used to
            render only in the jobs list, so scheduling an interview from
            here reported nothing — the modal closed and the screen looked
            exactly as it had before. */}
        {message && <p style={msg(message)}>{message}</p>}

        {/* Who this is, and how they score — readable in one glance. The
            name and the status each appear exactly once here; the interview
            modal renders their own copy when it is open. */}
        <div style={heroCard}>
          <div style={heroTop}>
            <span style={heroAvatar} aria-hidden="true">
              {(a.full_name || "?").trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={heroName}>{a.full_name || "Unnamed"}</h3>
              <div style={heroMeta}>{a.location || "No location set"}</div>
            </div>
            <div style={heroScore}>
              <div style={scoreRing(matchScore)}>{matchScore}%</div>
              <div style={heroScoreLabel}>skill match</div>
            </div>
          </div>
          <div style={heroFacts}>
            <span style={statusBadge(a.application?.status || "pending")}>
              {statusLabel(a.application?.status)}
            </span>
            <span style={heroFact}>
              {matched.length} of {matchTotal} requirements matched
            </span>
            {a.application?.created_at && (
              <span style={heroFact}>Applied {relativeTime(a.application.created_at)}</span>
            )}
          </div>
        </div>

        {/* WHY this person, for this particular job. The job sits directly
            above its requirements so the two can be read together instead of
            from memory of the row they clicked. */}
        <div style={sectionCard}>
          <div style={jobHead}>
            <span style={jobIcon} aria-hidden="true">
              {viewingJob?.icon || "💼"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={jobTitle}>{viewingJob?.title || "This job"}</div>
              <div style={jobMeta}>{viewingJob?.company}</div>
              {viewingJob?.location && <div style={jobMeta}>{viewingJob.location}</div>}
            </div>
          </div>

          {viewingJob?.description && <p style={jobDesc}>{viewingJob.description}</p>}

          {checklist.length > 0 && (
            <div>
              <div style={sectionLabel}>Requirements this job asks for</div>
              <div style={checkList}>
                {checklist.map((r) => (
                  <div key={r.name} style={checkItem(r.has)}>
                    <span style={checkMark(r.has)} aria-hidden="true">
                      {r.has ? "✓" : "✗"}
                    </span>
                    <span>{r.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {a.match?.explanation && (
            <div style={aiExplanation}>
              <strong>🤖 Match analysis:</strong> {a.match.explanation}
            </div>
          )}

          {a.match?.basicScore !== undefined && a.match.basicScore !== a.match.score && (
            <div style={comparisonRow}>
              <span style={comparisonLabel}>🔍 Basic Match</span>
              <span style={comparisonValue}>{a.match.basicScore}%</span>
              <span style={comparisonArrow}>→</span>
              <span style={{ ...comparisonLabel, color: "#93c5fd" }}>🤖 AI Match</span>
              <span style={{ ...comparisonValue, color: "#93c5fd" }}>{a.match.score}%</span>
            </div>
          )}
        </div>

        {/* What they say about themselves, written as prose rather than as
            one label:value line per fact. Empty fields are omitted instead
            of printing "Not set" five times. */}
        <div style={sectionCard}>
          <div style={sectionLabel}>About this applicant</div>

          <div style={aboutList}>
          {a.email && (
            <div style={aboutRow}>
              <span style={aboutKey}>Gmail</span>
              <div style={aboutValue}>
                <a href={`mailto:${a.email}`} style={emailLink}>{a.email}</a>
              </div>
            </div>
          )}
          {a.skills && (
            <div style={aboutRow}>
              <span style={aboutKey}>Skills</span>
              {/* A long skill column used to print in full and push the bio,
                  the contact details and the interview off the bottom of the
                  card. Preview plus toggle, same as everywhere else. */}
              <div style={aboutChips}>
                <SkillChips skills={a.skills} />
              </div>
            </div>
          )}

          {a.bio && (
            <div style={aboutRow}>
              <span style={aboutKey}>Bio</span>
              <p style={aboutBio}>{a.bio}</p>
            </div>
          )}

          <div style={aboutRow}>
            <span style={aboutKey}>Contact</span>
            <div style={aboutValue}>
              {a.location && <div>{a.location}</div>}
              {a.phone_number && <div>{a.phone_number}</div>}
              {!a.location && !a.phone_number && <div>Not set</div>}
            </div>
          </div>

          {a.resume_url && (
            <div style={aboutRow}>
              <span style={aboutKey}>Resume</span>
              <div>
                <a href={a.resume_url} target="_blank" rel="noreferrer" style={resumeViewBtn}>
                  📄 {a.resume_url.split("/").pop() || "View Resume"}
                </a>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* An appointment that exists belongs on the person it is for. The
            status badge could only ever say "interview_scheduled" — never
            when, where, or what the applicant was told to bring. */}
        {iv && (
          <div style={sectionCard}>
            <div style={sectionLabel}>Scheduled interview</div>
            <div style={aboutList}>
              <div style={aboutRow}>
                <span style={aboutKey}>When</span>
                <div style={aboutValue}>
                  <strong style={{ color: "#fff" }}>{formatDate(iv.date)}</strong>
                  {/* The space lives in the content, not in a margin — margin
                      leaves the copied or read-aloud text as "2026at 10:30 AM". */}
                  {iv.time && (
                    <>
                      {" "}at{" "}
                      <strong style={{ color: "#fff" }}>{formatTime(iv.time)}</strong>
                    </>
                  )}
                </div>
              </div>
              {iv.location && (
                <div style={aboutRow}>
                  <span style={aboutKey}>Where</span>
                  <div style={aboutValue}>{iv.location}</div>
                </div>
              )}
              {iv.instructions && (
                <div style={aboutRow}>
                  <span style={aboutKey}>Instructions</span>
                  <p style={aboutBio}>{iv.instructions}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* The decision, grouped on its own instead of buried among the
            facts it is based on. */}
        <div style={sectionCard}>
          <div style={sectionLabel}>Decision</div>

          {a.application?.status !== "hired" && a.application?.status !== "rejected" ? (
            <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
              {a.application?.status === "pending" && (
                <button onClick={() => updateApplicantStatus(a.application.id, "reviewed")} style={{
                  flex: 1, padding: "8px", backgroundColor: "#4a90e2", color: "#fff", border: "none",
                  borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer",
                }}>Review</button>
              )}
              {a.application?.status === "reviewed" && (
                <button onClick={() => updateApplicantStatus(a.application.id, "accepted")} style={{
                  flex: 1, padding: "8px", backgroundColor: "#22c55e", color: "#fff", border: "none",
                  borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer",
                }}>Accept</button>
              )}
              {a.application?.status === "interview_scheduled" && (
                <button onClick={() => updateApplicantStatus(a.application.id, "accepted")} style={{
                  flex: 1, padding: "8px", backgroundColor: "#22c55e", color: "#fff", border: "none",
                  borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer",
                }}>Accept</button>
              )}
              {a.application?.status === "accepted" && (
                <button onClick={() => updateApplicantStatus(a.application.id, "hired")} style={{
                  flex: 1, padding: "8px", backgroundColor: "#22c55e", color: "#fff", border: "none",
                  borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer",
                }}>Hire</button>
              )}
              <button onClick={() => updateApplicantStatus(a.application.id, "rejected")} style={{
                flex: 1, padding: "8px", backgroundColor: "#ef4444", color: "#fff", border: "none",
                borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer",
              }}>Reject</button>
            </div>
          ) : (
            <p style={closedText}>
              {a.application?.status === "hired"
                ? "Hired — nothing further to decide on this application."
                : "Not selected — this application is closed."}
            </p>
          )}

          {(a.application?.status === "reviewed" || a.application?.status === "pending" || a.application?.status === "interview_scheduled") && (
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button onClick={() => openInterviewModal(a)} style={{
                flex: 1, padding: "10px", backgroundColor: "rgba(139,92,246,0.2)", color: "#c4b5fd",
                border: "1px solid rgba(139,92,246,0.3)", borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer",
              }}>{a.application?.status === "interview_scheduled" ? "Reschedule Interview" : "Schedule Interview"}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "5px" }}><SkeletonTable rows={4} cols={7} /></div>;
  }

  return (
    <div style={container}>
      {interviewModal}

      <div style={headerRow}>
        <div>
          <h2 style={{ fontSize: "20px", color: "#fff", fontWeight: "800", margin: "0 0 4px" }}>Manage Jobs</h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>{jobs.length} job{jobs.length !== 1 ? "s" : ""} listed</p>
        </div>
        <button style={addBtn} onClick={() => { resetForm(); setShowForm(true); }}>+ New Job</button>
      </div>

      {message && <p style={msg(message)}>{message}</p>}

      {showForm && (
        <div style={formOverlay}>
          <div style={formModal}>
            <div style={formHeader}>
              <h3 style={{ margin: 0, color: "#fff" }}>{editing ? "Edit Job" : "Create New Job"}</h3>
              <button onClick={resetForm} style={closeBtn}>✕</button>
            </div>
            <div style={formBody}>
              <div style={fieldRow}>
                <div style={fieldHalf}>
                  <label style={label}>Job Title *</label>
                  <input style={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Sales Assistant" />
                </div>
                <div style={fieldHalf}>
                  <label style={label}>Icon</label>
                  <div style={iconGrid}>
                    {JOB_ICONS.map((ic) => (
                      <span key={ic} onClick={() => setForm({ ...form, icon: ic })}
                        style={{
                          ...iconOption,
                          border: form.icon === ic ? "2px solid #93c5fd" : "2px solid transparent",
                          transform: form.icon === ic ? "scale(1.15)" : "scale(1)",
                        }}>
                        {ic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={fieldRow}>
                <div style={fieldHalf}>
                  <label style={label}>Company</label>
                  <input style={input} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div style={fieldHalf}>
                  <label style={label}>Location</label>
                  <input style={input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
              </div>
              <div style={fieldGroup}>
                <label style={label}>Salary</label>
                <input style={input} value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="e.g. ₱15,000 — ₱18,000 / month" />
              </div>
              <div style={fieldGroup}>
                <label style={label}>Description</label>
                <textarea style={{ ...input, minHeight: "80px", resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={fieldGroup}>
                <label style={label}>Requirements & Skills</label>
                <SkillPicker
                  selected={form.requirements}
                  onChange={(next) => setForm({ ...form, requirements: next })}
                  options={skillCatalog?.options || []}
                  grouped={skillCatalog?.grouped || null}
                  allowCustom
                  onCreateCustom={handleCreateCustomSkill}
                  placeholder="Pick the skills this job needs..."
                  emptyMessage="Type a skill name to add the first one."
                />
                <p style={fieldHint}>
                  Applicants choose from this same list, so prefer it over inventing a wording —
                  it is what every match score is calculated against.
                </p>
              </div>
              <div style={fieldRow}>
                <div style={fieldHalf}>
                  <label style={label}>Maximum Applicants (0 = unlimited)</label>
                  <input style={input} type="number" min="0" value={form.max_applicants}
                    onChange={(e) => setForm({ ...form, max_applicants: parseInt(e.target.value) || 0 })}
                    placeholder="0 for unlimited" />
                </div>
                <div style={fieldHalf}>
                  <label style={label}>Visibility</label>
                  <select style={selectInput} value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="published">Published — visible to applicants</option>
                    <option value="draft">Draft — hidden from applicants</option>
                    <option value="closed">Closed — hidden, history kept</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={formFooter}>
              <button onClick={resetForm} style={cancelBtn}>Cancel</button>
              <button onClick={handleSave} style={{ ...saveBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                {saving ? "Saving..." : editing ? "Update Job" : "Create Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={dashTable}>
        <table style={tableStyle}>
          <thead>
            <tr style={dashRow}>
              <th style={dashTh}>Icon</th>
              <th style={dashTh}>Title</th>
              <th style={dashTh}>Status</th>
              <th style={dashTh}>Company</th>
              <th style={dashTh}>Location</th>
              <th style={dashTh}>Salary</th>
              <th style={dashTh}>Applicants</th>
              <th style={dashTh}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "rgba(255,255,255,0.5)" }}>
                  No jobs yet. Click "+ New Job" to create one.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <JobRow key={job.id} job={job} onEdit={openEdit} onToggleStatus={handleToggleStatus} onViewApplicants={viewApplicants} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobRow({ job, onEdit, onToggleStatus, onViewApplicants }) {
  const [appCount, setAppCount] = useState(null);

  useEffect(() => {
    // Same RPC as FindJobs/ApplyJob — one shared source of truth so the
    // admin row and the applicant card can never disagree.
    supabase.rpc("job_filled_counts").then(({ data }) => {
      const row = (data || []).find((r) => r.job_id === job.id);
      setAppCount(row ? Number(row.filled_count) : 0);
    });
  }, [job.id]);

  const maxApps = job.max_applicants || 0;
  const filled = appCount ?? 0;
  const isFull = maxApps > 0 && filled >= maxApps;
  // A row from before the status migration has no column at all; treat that
  // as published, which is what it has always behaved as.
  const status = job.status || "published";

  return (
    <tr style={{ ...dashRow, opacity: status === "draft" ? 0.6 : 1 }}>
      <td style={dashTd}><span style={{ fontSize: "20px" }}>{job.icon || "💼"}</span></td>
      <td style={{ ...dashTd, fontWeight: "600" }}>{job.title}</td>
      <td style={dashTd}><span style={statusChip(status)}>{status}</span></td>
      <td style={dashTd}>{job.company}</td>
      <td style={dashTd}>{job.location}</td>
      <td style={{ ...dashTd, fontSize: "12px" }}>{job.salary || "—"}</td>
      <td style={{ ...dashTd, textAlign: "center" }}>
        {maxApps > 0 ? (
          <span style={{
            fontSize: "12px", fontWeight: "600",
            color: isFull ? "#fca5a5" : "#86efac",
          }}>
            {filled}/{maxApps}
          </span>
        ) : (filled ?? "—")}
      </td>
      <td style={dashTd}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button style={viewBtn} onClick={() => onViewApplicants(job)}>Applicants</button>
          <button style={editBtn} onClick={() => onEdit(job)}>Edit</button>
          {/* Replaces the old Delete. Closing keeps every application and
              interview against the job; deleting cascaded them away. */}
          <button style={toggleStatusBtn} onClick={() => onToggleStatus(job)}>
            {status === "closed" ? "Reopen" : "Close"}
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * What the grid on screen actually contains, in one line.
 *
 * A subset read as a bare count reads as a total: "5 applicants" looks like a
 * job that only attracted five people. Every scope says how much of the roster
 * it left out.
 */
function scanSummary(shown, total, mode) {
  const noun = shown === 1 ? "applicant" : "applicants";
  if (mode === "quick") return `Quick scan: top ${shown} of ${total} by local skill match`;
  if (mode === "selected") return `Your selection: ${shown} of ${total}`;
  return `${shown} ${noun} — the whole roster`;
}

const JOB_ICONS = ["🏪", "🛍️", "💻", "🖥️", "🔧", "🛠️", "⚙️", "🧰", "🔌", "🖱️", "📋", "👥", "💰", "📦", "🎯", "⭐"];

const iconGrid = { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" };
const iconOption = { fontSize: "22px", cursor: "pointer", padding: "4px", borderRadius: "8px", lineHeight: "1" };
const progressWrap = { marginTop: "20px", textAlign: "center" };
const progressTrack = { height: "8px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden", marginBottom: "8px" };
const progressFill = { height: "100%", backgroundColor: "#4a90e2", borderRadius: "4px" };
const progressText = { fontSize: "13px", color: "rgba(255,255,255,0.5)", fontWeight: "500" };
const aiExplanation = { fontSize: "13px", color: "rgba(255,255,255,0.85)", backgroundColor: "rgba(74,144,226,0.1)", padding: "12px", borderRadius: "8px", marginBottom: "16px", lineHeight: "1.5" };
const comparisonRow = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", marginBottom: "16px", padding: "8px 12px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "8px" };
const comparisonLabel = { color: "rgba(255,255,255,0.5)", fontWeight: "500" };
const comparisonValue = { fontWeight: "700", color: "rgba(255,255,255,0.85)" };
const comparisonArrow = { color: "rgba(255,255,255,0.4)" };

const container = { padding: "5px" };
const headerRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" };
const addBtn = { background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: "700", fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 16px rgba(26,115,232,0.3)" };

const formOverlay = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" };
const formModal = { backgroundColor: "rgba(15,23,42,0.95)", borderRadius: radii.xl, width: "100%", maxWidth: "580px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" };
const formHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" };
const closeBtn = { background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "rgba(255,255,255,0.5)", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" };
const formBody = { padding: "20px 24px" };
const formFooter = { display: "flex", justifyContent: "flex-end", gap: "10px", padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.08)" };
const fieldRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const fieldHalf = { marginBottom: "14px" };
const fieldGroup = { marginBottom: "14px" };
const label = { display: "block", fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "4px", fontWeight: "500" };
const input = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", fontSize: "14px", outline: "none", boxSizing: "border-box", backgroundColor: "rgba(255,255,255,0.06)", color: "#fff", fontFamily: "inherit" };
// colorScheme so the native option list renders on the same dark surface
// instead of the browser's default white-on-white.
const selectInput = { ...input, colorScheme: "dark", cursor: "pointer" };
const fieldHint = { margin: "6px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: "1.5" };

// The applicant summary pinned to the top of the interview modal, so a date
// and time are never set against an unidentified row of data.
const applicantBanner = {
  marginBottom: "16px", padding: "12px", borderRadius: "8px",
  backgroundColor: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)",
};
const applicantBannerTop = { display: "flex", alignItems: "center", gap: "10px" };
const applicantAvatar = {
  width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  backgroundColor: "rgba(139,92,246,0.3)", color: "#c4b5fd",
  fontWeight: "700", fontSize: "14px",
};
const applicantBannerName = { color: "#fff", fontWeight: "700", fontSize: "14px" };
const applicantBannerMeta = {
  color: "rgba(255,255,255,0.5)", fontSize: "12px", marginTop: "2px",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const applicantBannerLine = { color: "rgba(255,255,255,0.6)", fontSize: "12px", marginTop: "6px" };
const applicantMatchBadge = {
  flexShrink: 0, fontSize: "11px", fontWeight: "700", padding: "3px 8px",
  borderRadius: "20px", backgroundColor: "rgba(34,197,94,0.2)", color: "#86efac",
};

// The location line in the interview modal. Deliberately a statement rather
// than an input — see INTERVIEW_LOCATION for why there is no dropdown.
const locationRow = {
  display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px",
  padding: "12px", borderRadius: "8px",
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
};
const locationPin = {
  width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "16px", backgroundColor: "rgba(34,197,94,0.15)",
};
const locationRowLabel = {
  display: "block", fontSize: "10px", fontWeight: "700", letterSpacing: "0.06em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.45)",
};
const locationRowValue = {
  display: "block", fontSize: "15px", fontWeight: "700", color: "#fff", marginTop: "2px",
};
const cancelBtn = { padding: "10px 20px", backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" };
const saveBtn = { padding: "10px 20px", background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px", boxShadow: "0 4px 16px rgba(26,115,232,0.3)" };

const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "700px" };
const editBtn = { padding: "4px 10px", fontSize: "11px", border: "none", borderRadius: "6px", backgroundColor: "rgba(74,144,226,0.2)", color: "#93c5fd", cursor: "pointer", fontWeight: "600" };
// Closing a job is reversible, so it gets the same soft treatment as any
// other toggle rather than the red of the delete it replaced.
const toggleStatusBtn = { padding: "4px 10px", fontSize: "11px", border: "none", borderRadius: "6px", backgroundColor: "rgba(251,191,36,0.2)", color: "#fbbf24", cursor: "pointer", fontWeight: "600" };
const statusChip = (status) => ({
  display: "inline-block", fontSize: "11px", fontWeight: "700", padding: "3px 9px",
  borderRadius: "20px", textTransform: "capitalize", whiteSpace: "nowrap",
  backgroundColor:
    status === "published" ? "rgba(34,197,94,0.2)"
    : status === "draft" ? "rgba(255,255,255,0.08)"
    : "rgba(239,68,68,0.18)",
  color:
    status === "published" ? "#86efac"
    : status === "draft" ? "rgba(255,255,255,0.6)"
    : "#fca5a5",
});
const viewBtn = { padding: "4px 10px", fontSize: "11px", border: "none", borderRadius: "6px", backgroundColor: "rgba(34,197,94,0.2)", color: "#86efac", cursor: "pointer", fontWeight: "600" };
const resumeViewBtn = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", border: "none", borderRadius: "8px", backgroundColor: "rgba(74,144,226,0.2)", color: "#93c5fd", cursor: "pointer", textDecoration: "none" };

const backBtn = { background: "none", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: "13px", fontWeight: "600", padding: 0, marginBottom: "8px" };
const candidateCard = { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.md, padding: "16px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" };
const candidateHeader = { display: "flex", alignItems: "center", gap: "12px" };
const avatarCircle = { width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px", flexShrink: 0 };
const scoreCircle = (score) => ({ width: "44px", height: "44px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "13px", color: score >= 80 ? "#86efac" : score >= 50 ? "#fbbf24" : "#fca5a5", backgroundColor: score >= 80 ? "rgba(34,197,94,0.2)" : score >= 50 ? "rgba(217,119,6,0.2)" : "rgba(239,68,68,0.2)", flexShrink: 0 });
const matchBarOuter = { height: "6px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "3px", marginTop: "10px", overflow: "hidden" };
const matchBarInner = (score) => ({ height: "100%", borderRadius: "3px", backgroundColor: score >= 80 ? "#22c55e" : score >= 50 ? "#d97706" : "#ef4444", width: `${score}%` });
const matchTag = { fontSize: "11px", color: "#86efac", fontWeight: "500" };
const aiBadge = { fontSize: "9px", fontWeight: "800", padding: "2px 5px", borderRadius: "4px", backgroundColor: "#4a90e2", color: "#fff", letterSpacing: "0.5px" };
const analyzingOverlay = { display: "flex", justifyContent: "center", padding: "60px 20px" };
const analyzingContent = { textAlign: "center" };

// --- Scan picker (Quick Scan vs full run) ----------------------------------
const scanNote = {
  backgroundColor: "rgba(74,144,226,0.12)", border: "1px solid rgba(74,144,226,0.35)",
  color: "rgba(255,255,255,0.75)", fontSize: "12.5px", padding: "9px 12px",
  borderRadius: "8px", marginBottom: "12px",
};
const scanLink = {
  background: "none", border: "none", color: "#93c5fd", cursor: "pointer",
  fontSize: "12.5px", fontWeight: "700", padding: 0, textDecoration: "underline",
};

// --- Results toolbar (after a scan has run) --------------------------------
const resultsHead = {
  display: "flex", alignItems: "baseline", justifyContent: "space-between",
  gap: "10px", margin: "16px 0 10px",
};
const resultsTitle = { color: "#fff", fontSize: "14px", fontWeight: "700" };
const resultsMeta = { color: "rgba(255,255,255,0.45)", fontSize: "12px", textAlign: "right" };
// Same two controls, in the same order, as the Admin Applicants page — a scan
// action should not have a different shape depending on which page it was
// started from.
const resultsToolbar = { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" };
const resultsLink = {
  background: "none", border: "none", color: "#93c5fd", cursor: "pointer",
  fontSize: "12.5px", fontWeight: "600", padding: 0,
};
const cancelScanBtn = {
  marginTop: "16px", backgroundColor: "transparent",
  border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.75)",
  padding: "7px 16px", borderRadius: "8px", fontSize: "12.5px", fontWeight: "600",
  cursor: "pointer",
};

/* ── Applicant detail ──────────────────────────────────────────────
   The old view was one card with eight label:value rows at the same
   weight: the score, the person and the decision all ran together, and
   nothing said how the two related. It is now three cards under a hero —
   what the job needs, who they are, what to do about it — so an employer
   can answer "why are they applying for THIS job" without doing sums. */

// Hero: identity, score and status in one glance.
const heroCard = { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.lg, padding: "20px", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)", marginBottom: "16px" };
const heroTop = { display: "flex", alignItems: "center", gap: "14px" };
const heroAvatar = { width: "52px", height: "52px", borderRadius: "50%", background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "20px", flexShrink: 0 };
const heroName = { color: "#fff", fontSize: "19px", fontWeight: "800", margin: "0 0 2px", lineHeight: 1.2 };
const heroMeta = { fontSize: "13px", color: "rgba(255,255,255,0.55)" };
const heroScore = { textAlign: "center", flexShrink: 0 };
const scoreRing = (score) => ({
  width: "62px", height: "62px", borderRadius: "50%", display: "flex", alignItems: "center",
  justifyContent: "center", fontWeight: "800", fontSize: "15px", marginLeft: "auto",
  color: score >= 80 ? "#86efac" : score >= 50 ? "#fbbf24" : "#fca5a5",
  backgroundColor: score >= 80 ? "rgba(34,197,94,0.2)" : score >= 50 ? "rgba(217,119,6,0.2)" : "rgba(239,68,68,0.2)",
  border: `3px solid ${score >= 80 ? "#22c55e" : score >= 50 ? "#d97706" : "#ef4444"}`,
});
const heroScoreLabel = { fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.6px", marginTop: "5px", fontWeight: "700" };
const heroFacts = { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.08)" };
const heroFact = { fontSize: "12px", color: "rgba(255,255,255,0.55)" };

// Shared chrome for the three cards under the hero.
const sectionCard = { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: radii.lg, padding: "20px", border: "1px solid rgba(255,255,255,0.09)", marginBottom: "16px" };
const sectionLabel = { fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.4)", marginBottom: "12px" };

// The job, stated directly above the requirements it generated.
const jobHead = { display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" };
const jobIcon = { width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(74,144,226,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 };
const jobTitle = { color: "#fff", fontSize: "15px", fontWeight: "700", lineHeight: 1.3 };
const jobMeta = { fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "2px" };
// Clamped rather than truncated: long postings still give the employer
// context without pushing the verdict they are here to read off screen.
const jobDesc = { fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, margin: "0 0 14px", whiteSpace: "pre-wrap", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4, overflow: "hidden" };

// The requirements, ticked or crossed one by one.
const checkList = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "8px", marginBottom: "14px" };
const checkItem = (has) => ({
  display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600",
  padding: "8px 10px", borderRadius: "8px",
  backgroundColor: has ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
  border: `1px solid ${has ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)"}`,
  color: has ? "#86efac" : "#fca5a5",
});
const checkMark = (has) => ({
  width: "18px", height: "18px", borderRadius: "50%", display: "inline-flex",
  alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800",
  flexShrink: 0, lineHeight: "1", backgroundColor: has ? "#22c55e" : "#ef4444", color: "#fff",
});

// Their own words, laid out as prose rather than one row per fact.
const aboutList = { display: "flex", flexDirection: "column", gap: "12px" };
const aboutRow = { display: "flex", gap: "14px", alignItems: "flex-start", fontSize: "13px" };
const aboutKey = { width: "74px", flexShrink: 0, color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", paddingTop: "3px" };
const aboutChips = { display: "flex", gap: "6px", flexWrap: "wrap", flex: 1, minWidth: 0 };
const aboutBio = { margin: 0, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, flex: 1, minWidth: 0 };
const aboutValue = { color: "rgba(255,255,255,0.85)", lineHeight: 1.6, minWidth: 0 };
const emailLink = { color: "#93c5fd", fontWeight: "600", textDecoration: "none", wordBreak: "break-all" };
const closedText = { fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "4px 0 0", fontStyle: "italic" };
