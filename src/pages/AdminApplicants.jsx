import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { radii, dashGrid } from "../uiStyles";
import { SkeletonLine, SkeletonCard } from "../components/Skeleton";
import { aiSkillMatch } from "../lib/aiSkillMatch";
import { runInParallel, DEFAULT_CONCURRENCY } from "../lib/batchMatch";
import { formatDate, formatTime } from "../lib/format";
import ApplicantSelection, { AnalyzeSelectedButton } from "../components/ApplicantSelection";

export default function AdminApplicants() {
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rankedApplicants, setRankedApplicants] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  // Quick Scan is still gone from this page: these are registered profiles
  // rather than a job's own applicants, so there is no requirement to pre-rank
  // them against and the free matcher would have had nothing to say.
  //
  // Scan all is kept, because it is not a competing way to choose — it is
  // Select all followed by the counted action in a single press. Both sit in
  // the same decision band so the scopes read as one choice rather than three
  // separate features.
  //
  // Distinguishes "no run yet" from "a run that found nobody": the frame
  // before the effect fires would otherwise read as an empty result.
  const [hasRanked, setHasRanked] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0, name: "" });

  // The employer's hand-picked subset. A plain id array rather than a Set so
  // it can go straight into state (Sets compare by identity, which would
  // re-render the picker on every unrelated change).
  const [selectedIds, setSelectedIds] = useState([]);

  // Every interview on file, with its application (and that application's
  // job) embedded. Booking happens on Manage Jobs, so without this the admin
  // had to leave the page to find out what they had just scheduled — the only
  // trace here was nothing at all.
  const [interviews, setInterviews] = useState([]);

  // Bumped to invalidate a scan still in flight (job switched, Cancel pressed,
  // component unmounted). Every await re-checks it, so a slow run can never
  // write into a view that has already moved to another job.
  const runIdRef = useRef(0);

  useEffect(() => {
    Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, skills, location, phone_number, resume_url, bio, created_at")
        .eq("role", "applicant"),
      // interviews hangs off applications, which hangs off profiles and jobs —
      // one nested read rather than a round trip per applicant. Every embed is
      // a real foreign key, so PostgREST resolves it without a hint.
      supabase
        .from("interviews")
        .select(
          "id, date, time, location, instructions, status, " +
            "applications(user_id, job_id, jobs(title))"
        )
        .order("date", { ascending: true }),
    ]).then(([jobsRes, appsRes, ivRes]) => {
      if (jobsRes.data) setJobs(jobsRes.data);
      if (appsRes.data) setApplicants(appsRes.data);
      if (ivRes.data) setInterviews(ivRes.data);
      setLoading(false);
    });
  }, []);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  // Shown both before a scan runs (nobody registered) and when a scan runs and
  // finds nobody — same meaning either way, so it is not written out twice.
  const noApplicantsCard = (
    <div style={{ ...guideCard, marginTop: "4px" }}>
      <span style={guideIcon} aria-hidden="true">🧩</span>
      <div style={{ minWidth: 0 }}>
        <div style={guideTitle}>No applicants with skills found</div>
        <div style={guideText}>
          Nobody registered yet has set the skills this job asks for.
        </div>
      </div>
    </div>
  );

  // Selecting a job no longer starts a scan by itself — the employer ticks
  // people and presses Analyze. This effect only clears the previous job's
  // results and cancels anything still in flight.
  //
  // It deliberately depends on selectedJobId ALONE. The old version also
  // listed `applicants` and `selectedJob`, so any new array identity could
  // restart an entire ranking the admin never asked for — which is a quota
  // cost and a spinner the user did nothing to trigger.
  useEffect(() => {
    runIdRef.current += 1;
    setAnalyzing(false);
    setHasRanked(false);
    setRankedApplicants([]);
    // The ticks belong to the job they were made against. Carrying them to
    // the next posting would silently decide who gets charged for it.
    setSelectedIds([]);
    setAnalyzeProgress({ current: 0, total: 0, name: "" });
  }, [selectedJobId]);

  const cancelScan = () => {
    // Invalidates the in-flight run: lanes stop picking up new work and its
    // results are never committed.
    runIdRef.current += 1;
    setAnalyzing(false);
  };

  /**
   * Run the AI scan over exactly the rows the employer ticked.
   *
   * The caller hands over the already-filtered list rather than a scope: with
   * no scope to interpret, there is nothing in here that can widen the batch,
   * so quota can only go where it was pointed. `runInParallel` then overlaps
   * those calls in a fixed pool of DEFAULT_CONCURRENCY lanes and hands back
   * index-aligned results.
   *
   * @param {Array} people  The applicants to score.
   */
  const runScan = async (people) => {
    const requirements = selectedJob?.requirements || [];
    const title = selectedJob?.title || "";

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const cancelled = () => runIdRef.current !== runId;

    // The button is already disabled at zero, so this only guards a caller
    // that filters to nobody — never worth a spinner or a scan to say nothing.
    const targets = people || [];
    if (targets.length === 0) return;

    setAnalyzing(true);
    setHasRanked(false);
    setRankedApplicants([]);
    setAnalyzeProgress({ current: 0, total: targets.length, name: "" });

    const ranked = [];
    try {
      await runInParallel(
        targets,
        (person) => aiSkillMatch(person.skills, requirements, title),
        {
          concurrency: DEFAULT_CONCURRENCY,
          isCancelled: cancelled,
          onResult: (match, index, completed, total) => {
            if (cancelled()) return;
            ranked.push({ ...targets[index], match });
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
        // ONE commit, ONE sort. The overlay covers the grid while the scan
        // runs, so the old per-iteration `sort()` + fresh array produced n
        // orderings nobody could see: n sorts, n full grid re-renders.
        setRankedApplicants(ranked.sort((a, b) => b.match.score - a.match.score));
        setHasRanked(true);
        setAnalyzing(false);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "5px" }}>
        <SkeletonLine width="200px" height="24px" />
        <div style={{ height: "16px" }} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (selectedApplicant) {
    const match = selectedJob ? selectedApplicant.match : null;
    const name = selectedApplicant.full_name || "Unnamed";
    // Parsed once here rather than per chip: a skills column is one comma
    // string, and rendering it as text wall-to-wall was the main reason this
    // card was hard to read.
    const skills = String(selectedApplicant.skills || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // This person's interviews, matched on the embedded application rather
    // than on a job — it still reads correctly when no job is chosen yet.
    const mine = interviews.filter((iv) => iv.applications?.user_id === selectedApplicant.id);
    const contact = [selectedApplicant.location, selectedApplicant.phone_number]
      .filter(Boolean)
      .join(" · ");

    return (
      <div style={container}>
        <button style={backBtn} onClick={() => setSelectedApplicant(null)}>
          ← Back to applicants
        </button>
        <div style={detailCard}>
          {/* WHO, before WHAT they scored. */}
          <div style={detailHead}>
            <span style={detailAvatar} aria-hidden="true">
              {(name.trim()[0] || "?").toUpperCase()}
            </span>
            <div style={{ minWidth: 0 }}>
              <h3 style={detailName}>{name}</h3>
              <div style={detailMeta}>{contact || "No contact details set"}</div>
            </div>
          </div>

          {/* The verdict: one number, then the reason for it. */}
          <div style={block}>
            <div style={blockLabel}>How they score</div>

            {match ? (
              <>
                <div style={scoreRow}>
                  <span style={scorePct}>{match.score}%</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={scoreCaption}>
                      Against {selectedJob?.title || "this job"}
                    </div>
                    <div style={scoreCounts}>
                      {match.matched} of {match.total} required skills matched
                    </div>
                    <div style={matchBar}>
                      <div style={matchBarFill(match.score)} />
                    </div>
                  </div>
                </div>

                {match.explanation && (
                  <div style={aiExplanation}>
                    <strong>🤖 Gemini Analysis:</strong> {match.explanation}
                  </div>
                )}

                {match.basicScore !== undefined && match.basicScore !== match.score && (
                  <div style={comparisonRow}>
                    <span style={comparisonLabel}>🔍 Basic Match</span>
                    <span style={comparisonValue}>{match.basicScore}%</span>
                    <span style={comparisonArrow}>→</span>
                    <span style={{ ...comparisonLabel, color: "#93c5fd" }}>🤖 AI Match</span>
                    <span style={{ ...comparisonValue, color: "#93c5fd" }}>{match.score}%</span>
                  </div>
                )}

                {match.matchedItems.length > 0 && (
                  <div style={listBlock}>
                    <div style={listLabel}>Matched Skills</div>
                    <div style={chipWrap}>
                      {match.matchedItems.map((s) => (
                        <span key={s} style={matchBadge}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {match.missingItems.length > 0 && (
                  <div style={listBlock}>
                    <div style={listLabel}>Missing Skills</div>
                    <div style={chipWrap}>
                      {match.missingItems.map((s) => (
                        <span key={s} style={missingBadge}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p style={mutedNote}>
                Choose a job above to score this applicant against its requirements.
              </p>
            )}
          </div>

          {/* The appointment. Booking it happens on Manage Jobs, so this is
              the only place an admin sees the result without leaving. */}
          {mine.length > 0 && (
            <div style={block}>
              <div style={blockLabel}>
                Scheduled interview{mine.length === 1 ? "" : "s"}
              </div>
              {mine.map((iv) => (
                <div key={iv.id} style={ivCard}>
                  <div style={ivWhen}>
                    <strong style={{ color: "#fff" }}>{formatDate(iv.date)}</strong>
                    {iv.time && (
                      <span style={{ marginLeft: "6px" }}>
                        at <strong style={{ color: "#fff" }}>{formatTime(iv.time)}</strong>
                      </span>
                    )}
                  </div>
                  {(iv.applications?.jobs?.title || iv.location) && (
                    <div style={ivMeta}>
                      {iv.applications?.jobs?.title && (
                        <span style={ivTag}>{iv.applications.jobs.title}</span>
                      )}
                      {iv.location && <span style={ivTag}>{iv.location}</span>}
                    </div>
                  )}
                  {iv.instructions && <p style={ivNotes}>{iv.instructions}</p>}
                </div>
              ))}
            </div>
          )}

          {/* The facts, kept apart from the score they feed into. */}
          {(skills.length > 0 || selectedApplicant.bio || selectedApplicant.resume_url) && (
            <div style={block}>
              <div style={blockLabel}>About</div>
              <div style={factList}>
                {skills.length > 0 && (
                  <div style={factRow}>
                    <span style={factKey}>Skills</span>
                    <div style={chipWrap}>
                      {skills.map((s) => (
                        <span key={s} style={skillChip}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedApplicant.bio && (
                  <div style={factRow}>
                    <span style={factKey}>Bio</span>
                    <p style={factValue}>{selectedApplicant.bio}</p>
                  </div>
                )}
                {selectedApplicant.resume_url && (
                  <div style={factRow}>
                    <span style={factKey}>Resume</span>
                    <div>
                      <a
                        href={selectedApplicant.resume_url}
                        target="_blank"
                        rel="noreferrer"
                        style={resumeLink}
                      >
                        View Resume ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <div style={pageHead}>
        <div style={{ minWidth: 0 }}>
          <h2 style={pageTitle}>Applicants</h2>
          <p style={pageSub}>
            Scored against a job's requirements — matched skills, missing skills and an
            overall percentage.
          </p>
        </div>
        <span style={countChip}>
          <strong style={{ color: "#fff" }}>{applicants.length}</strong>{" "}
          registered
        </span>
      </div>

      <div style={fieldGroup}>
        <label style={label} htmlFor="rank-job">
          Rank applicants against a job
        </label>
        <div style={selectWrap}>
          <span style={selectIcon} aria-hidden="true">🎯</span>
          <select
            id="rank-job"
            style={select}
            value={selectedJobId || ""}
            onChange={(e) => {
              setSelectedJobId(e.target.value ? parseInt(e.target.value) : null);
              setSelectedApplicant(null);
            }}
          >
            <option value="">Choose a job…</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id} style={{ color: "#1e293b", background: "#fff" }}>
                {job.icon} {job.title}
              </option>
            ))}
          </select>
        </div>

        {/* Nothing ranked until a job is chosen, and an empty page says why
            nothing is there without saying what to do about it. */}
        {!selectedJob && (
          <div style={guideCard}>
            <span style={guideIcon} aria-hidden="true">📊</span>
            <div style={{ minWidth: 0 }}>
              <div style={guideTitle}>Pick a job to start ranking</div>
              <div style={guideText}>
                Every registered applicant is scored against that job's requirements, so
                the strongest matches rise to the top.
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedJob && (
        <>
          <div style={jobInfo}>
            <div style={jobInfoHead}>
              <span style={jobInfoIcon} aria-hidden="true">{selectedJob.icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={jobInfoTitle}>{selectedJob.title}</strong>
                <div style={jobInfoMeta}>
                  {selectedJob.company} · {selectedJob.location}
                </div>
              </div>
            </div>
            <div style={reqRow}>
              <span style={reqLabel}>Requirements</span>
              <div style={reqChips}>
                {(selectedJob.requirements || []).length === 0 ? (
                  <span style={reqChipMuted}>None listed</span>
                ) : (
                  selectedJob.requirements.map((r) => (
                    <span key={r} style={reqChip}>{r}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {analyzing ? (
            <div style={analyzingOverlay}>
              <div style={analyzingContent}>
                <span style={{ fontSize: "40px" }}>🧠</span>
                <p style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: "12px 0 4px" }}>
                  AI Analyzing Applicants
                </p>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                  {`Scoring ${analyzeProgress.total} applicant${
                    analyzeProgress.total === 1 ? "" : "s"
                  } against ${selectedJob?.title || "this job"} — ${DEFAULT_CONCURRENCY} at a time.`}
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
                {/* Nothing used to be able to stop this: a hung call pinned the
                    overlay open. aiSkillMatch now times out, and this cancels
                    the rest of the batch. */}
                <button style={cancelScanBtn} onClick={cancelScan}>
                  Cancel
                </button>
              </div>
            </div>
          ) : !hasRanked ? (
            applicants.length === 0 ? (
              noApplicantsCard
            ) : (
              <ApplicantSelection
                items={applicants}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
                onAnalyze={() => runScan(applicants.filter((p) => selectedIds.includes(p.id)))}
                onScanAll={() => runScan(applicants)}
                title={`Choose applicants to score against ${selectedJob?.title || "this job"}`}
                subtitle="Tick the people worth a Gemini call, or take the whole roster with Scan all."
              />
            )
          ) : (
            <>
              <div style={resultsHead}>
                {/* Same heading and same toolbar as Manage Jobs' results, so a
                    scan that finished looks the same wherever it was started. */}
                <span style={resultsTitle}>Analyzed results</span>
                <span style={resultsMeta}>
                  {`Your selection: ${rankedApplicants.length} of ${applicants.length}`}
                </span>
              </div>
              <div style={resultsToolbar}>
                <AnalyzeSelectedButton
                  count={selectedIds.length}
                  onClick={() => runScan(applicants.filter((p) => selectedIds.includes(p.id)))}
                />
                {/* Stepping back to the picker must not cost the answers
                    already on screen: `rankedApplicants` stays in state, and the
                    next "Analyze Selected" simply replaces it with one commit. */}
                <button style={resultsLink} onClick={() => setHasRanked(false)}>
                  ← Change selection
                </button>
              </div>
              {rankedApplicants.length === 0 && noApplicantsCard}
            </>
          )}

          {!analyzing && hasRanked && rankedApplicants.length > 0 && (
            <div style={dashGrid}>
              {rankedApplicants.map((a) => (
                <div key={a.id} style={candidateCard} onClick={() => setSelectedApplicant(a)}>
                  <div style={candidateHeader}>
                    <div style={avatarCircle}>{a.full_name?.[0] || "?"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: "600", color: "#fff", fontSize: "14px" }}>
                        {a.full_name || "Unnamed"}
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                        {a.location || "No location"}
                      </div>
                    </div>
                    <div style={scoreCircle(a.match.score)}>{a.match.score}%</div>
                  </div>
                  {a.match?.basicScore !== undefined && a.match.basicScore !== a.match.score && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>🔍 {a.match.basicScore}%</span>
                      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>→</span>
                      <span style={aiBadge}>AI</span>
                      <span style={{ fontSize: "10px", color: "#93c5fd", fontWeight: "600" }}>{a.match.score}%</span>
                    </div>
                  )}
                  {!a.match?.basicScore || a.match.basicScore === a.match.score ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <span style={aiBadge}>AI</span>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>Skill Match</span>
                    </div>
                  ) : null}
                  <div style={matchBar}>
                    <div style={matchBarFill(a.match.score)} />
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "8px" }}>
                    Matched {a.match.matched}/{a.match.total} requirements
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const scoreCircle = (score) => ({
  width: "44px", height: "44px", borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: "800", fontSize: "13px",
  color: score >= 80 ? "#86efac" : score >= 50 ? "#fbbf24" : "#fca5a5",
  backgroundColor: score >= 80 ? "rgba(34,197,94,0.2)" : score >= 50 ? "rgba(217,119,6,0.2)" : "rgba(239,68,68,0.2)",
  flexShrink: 0,
});

const container = { padding: "5px" };
const fieldGroup = { marginBottom: "16px" };
const label = { display: "block", fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "6px", fontWeight: "600", letterSpacing: "0.3px" };

const pageHead = {
  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
  gap: "12px", margin: "0 0 20px",
};
const pageTitle = { fontSize: "20px", color: "#fff", fontWeight: "800", margin: "0 0 4px" };
const pageSub = { fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: "1.5" };
const countChip = {
  flexShrink: 0, fontSize: "12px", color: "rgba(255,255,255,0.6)",
  backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "20px", padding: "6px 12px", whiteSpace: "nowrap",
};

const selectWrap = {
  display: "flex", alignItems: "center", gap: "8px",
  backgroundColor: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "10px", padding: "2px 12px",
};
const selectIcon = { fontSize: "15px", flexShrink: 0 };
const select = {
  flex: 1, minWidth: 0, padding: "10px 0", border: "none",
  fontSize: "14px", outline: "none", backgroundColor: "transparent",
  color: "#fff", cursor: "pointer",
};

/**
 * What to do next, when there is nothing to show yet. An empty page that
 * only reports its own emptiness leaves the reader stuck at the same
 * question they arrived with.
 */
const guideCard = {
  display: "flex", alignItems: "flex-start", gap: "12px",
  marginTop: "16px", padding: "16px",
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px dashed rgba(255,255,255,0.16)",
  borderRadius: radii.md,
};
const guideIcon = { fontSize: "20px", flexShrink: 0, lineHeight: 1.2 };
const guideTitle = { color: "#fff", fontWeight: "700", fontSize: "14px", marginBottom: "4px" };
const guideText = { color: "rgba(255,255,255,0.55)", fontSize: "13px", lineHeight: "1.55" };

const jobInfo = {
  backgroundColor: "rgba(255,255,255,0.06)", padding: "16px", borderRadius: radii.md,
  marginBottom: "20px", border: "1px solid rgba(255,255,255,0.1)", fontSize: "14px",
};
const jobInfoHead = { display: "flex", alignItems: "center", gap: "12px" };
const jobInfoIcon = {
  width: "38px", height: "38px", borderRadius: "10px", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "18px", backgroundColor: "rgba(96,165,250,0.16)",
  border: "1px solid rgba(96,165,250,0.28)",
};
const jobInfoTitle = { color: "#fff", fontSize: "15px", fontWeight: "700", display: "block" };
const jobInfoMeta = { color: "rgba(255,255,255,0.5)", fontSize: "12.5px", marginTop: "2px" };
const reqRow = { display: "flex", alignItems: "baseline", gap: "10px", marginTop: "14px", flexWrap: "wrap" };
const reqLabel = {
  fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: "700",
  textTransform: "uppercase", letterSpacing: "0.6px",
};
const reqChips = { display: "flex", gap: "6px", flexWrap: "wrap" };
const reqChip = {
  fontSize: "11.5px", padding: "3px 9px", borderRadius: "12px",
  backgroundColor: "rgba(74,144,226,0.16)", color: "#93c5fd",
  border: "1px solid rgba(74,144,226,0.28)", fontWeight: "600",
};
const reqChipMuted = { fontSize: "11.5px", color: "rgba(255,255,255,0.45)", fontStyle: "italic" };

const resultsHead = {
  display: "flex", alignItems: "baseline", justifyContent: "space-between",
  gap: "10px", margin: "0 0 12px",
};
const resultsTitle = { color: "#fff", fontSize: "14px", fontWeight: "700" };
const resultsMeta = { color: "rgba(255,255,255,0.45)", fontSize: "12px" };
const resultsToolbar = { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" };
const resultsLink = {
  background: "none", border: "none", color: "#93c5fd", cursor: "pointer",
  fontSize: "12.5px", fontWeight: "600", padding: 0,
};
const candidateCard = {
  backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.md, padding: "16px",
  cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(8px)",
};
const candidateHeader = { display: "flex", alignItems: "center", gap: "12px" };
const avatarCircle = {
  width: "36px", height: "36px", borderRadius: "50%",
  background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: "700", fontSize: "14px", flexShrink: 0,
};
const matchBar = {
  height: "6px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "3px", marginTop: "10px", overflow: "hidden",
};
const matchBarFill = (score) => ({
  height: "100%", borderRadius: "3px",
  backgroundColor: score >= 80 ? "#22c55e" : score >= 50 ? "#d97706" : "#ef4444",
  width: `${score}%`,
});
const backBtn = {
  background: "none", border: "none", color: "#93c5fd", cursor: "pointer",
  fontSize: "13px", fontWeight: "600", padding: 0, marginBottom: "16px",
};
const detailCard = {
  backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.lg, padding: "24px",
  border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)",
};
// --- Applicant detail -------------------------------------------------------
// The card was one flat run of label:value lines that read as a data dump. It
// is now three labelled blocks — verdict, appointment, facts — so the eye
// lands on the score first and the prose last.
const detailHead = { display: "flex", alignItems: "center", gap: "14px", marginBottom: "4px" };
const detailAvatar = {
  width: "46px", height: "46px", borderRadius: "50%", flexShrink: 0,
  background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: "700", fontSize: "17px",
};
const detailName = { color: "#fff", fontWeight: "800", fontSize: "19px", margin: 0, lineHeight: 1.3 };
const detailMeta = { color: "rgba(255,255,255,0.5)", fontSize: "13px", marginTop: "3px" };

const block = { padding: "18px 0 0", marginTop: "18px", borderTop: "1px solid rgba(255,255,255,0.07)" };
const blockLabel = {
  fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: "700",
  textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "13px",
};

const scoreRow = { display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px" };
const scorePct = {
  fontSize: "40px", fontWeight: "800", color: "#fff", lineHeight: 1,
  fontVariantNumeric: "tabular-nums", flexShrink: 0,
};
const scoreCaption = { color: "rgba(255,255,255,0.85)", fontSize: "13.5px", fontWeight: "600" };
const scoreCounts = { color: "rgba(255,255,255,0.5)", fontSize: "12.5px", margin: "3px 0 8px" };

const listBlock = { marginTop: "14px" };
const listLabel = {
  fontSize: "12.5px", fontWeight: "700", color: "rgba(255,255,255,0.75)", marginBottom: "7px",
};
const chipWrap = { display: "flex", gap: "6px", flexWrap: "wrap" };
const skillChip = {
  fontSize: "11.5px", padding: "4px 9px", borderRadius: "12px",
  backgroundColor: "rgba(74,144,226,0.14)", color: "#93c5fd",
  border: "1px solid rgba(74,144,226,0.26)", fontWeight: "600",
};
const mutedNote = {
  color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: 0, fontStyle: "italic",
};

// Scheduled interview, tinted purple to match the modal that creates it.
const ivCard = {
  backgroundColor: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.28)",
  borderRadius: radii.md, padding: "13px 15px", marginBottom: "8px",
};
const ivWhen = { color: "#fff", fontSize: "14px", lineHeight: 1.5 };
const ivMeta = { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" };
const ivTag = {
  fontSize: "11.5px", padding: "3px 9px", borderRadius: "12px",
  backgroundColor: "rgba(139,92,246,0.2)", color: "#c4b5fd", fontWeight: "600",
};
const ivNotes = {
  color: "rgba(255,255,255,0.65)", fontSize: "12.5px", margin: "9px 0 0", lineHeight: 1.55,
};

const factList = { display: "flex", flexDirection: "column", gap: "14px" };
// Label column rather than `Skills: text` — the eye can then run straight
// down the values without re-finding the label in every line.
const factRow = { display: "grid", gridTemplateColumns: "74px 1fr", gap: "12px", alignItems: "start" };
const factKey = {
  fontSize: "11.5px", color: "rgba(255,255,255,0.45)", fontWeight: "700",
  textTransform: "uppercase", letterSpacing: "0.5px", paddingTop: "3px",
};
const factValue = { fontSize: "13.5px", color: "rgba(255,255,255,0.85)", lineHeight: 1.6, margin: 0 };
const resumeLink = { color: "#93c5fd", fontSize: "13.5px", fontWeight: "600", textDecoration: "none" };
const matchBadge = {
  fontSize: "11px", padding: "3px 8px", borderRadius: "12px",
  backgroundColor: "rgba(34,197,94,0.2)", color: "#86efac", fontWeight: "600",
};
const missingBadge = {
  fontSize: "11px", padding: "3px 8px", borderRadius: "12px",
  backgroundColor: "rgba(239,68,68,0.2)", color: "#fca5a5", fontWeight: "600",
};
const aiBadge = { fontSize: "9px", fontWeight: "800", padding: "2px 5px", borderRadius: "4px", backgroundColor: "#4a90e2", color: "#fff", letterSpacing: "0.5px" };
const analyzingOverlay = { display: "flex", justifyContent: "center", padding: "60px 20px" };
const analyzingContent = { textAlign: "center" };

// --- After a scan: results header and action row ---------------------------
const cancelScanBtn = {
  marginTop: "16px", backgroundColor: "transparent",
  border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.75)",
  padding: "7px 16px", borderRadius: "8px", fontSize: "12.5px", fontWeight: "600",
  cursor: "pointer",
};
const aiExplanation = { fontSize: "13px", color: "rgba(255,255,255,0.85)", backgroundColor: "rgba(74,144,226,0.1)", padding: "12px", borderRadius: "8px", marginBottom: "16px", lineHeight: "1.5" };
const comparisonRow = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", marginBottom: "16px", padding: "8px 12px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "8px" };
const comparisonLabel = { color: "rgba(255,255,255,0.5)", fontWeight: "500" };
const comparisonValue = { fontWeight: "700", color: "rgba(255,255,255,0.85)" };
const comparisonArrow = { color: "rgba(255,255,255,0.4)" };
const progressWrap = { marginTop: "20px", textAlign: "center" };
const progressTrack = { height: "8px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden", marginBottom: "8px" };
const progressFill = { height: "100%", backgroundColor: "#4a90e2", borderRadius: "4px" };
const progressText = { fontSize: "13px", color: "rgba(255,255,255,0.5)", fontWeight: "500" };
