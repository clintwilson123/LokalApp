import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { radii, dashGrid } from "../uiStyles";
import { SkeletonLine, SkeletonCard } from "../components/Skeleton";
import { aiSkillMatch } from "../lib/aiSkillMatch";
import { runInParallel, DEFAULT_CONCURRENCY } from "../lib/batchMatch";
import ApplicantSelection, { AnalyzeSelectedButton } from "../components/ApplicantSelection";

export default function AdminApplicants() {
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rankedApplicants, setRankedApplicants] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  // There is exactly one scan scope here now: the rows the employer ticked.
  // Quick Scan and "Analyze all" used to live on this page too, but they
  // answered a question the checkboxes already answer better — which people
  // are worth Gemini quota — so a second, competing way to choose just made
  // the panel harder to read without saving a single decision.
  //
  // Distinguishes "no run yet" from "a run that found nobody": the frame
  // before the effect fires would otherwise read as an empty result.
  const [hasRanked, setHasRanked] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0, name: "" });

  // The employer's hand-picked subset. A plain id array rather than a Set so
  // it can go straight into state (Sets compare by identity, which would
  // re-render the picker on every unrelated change).
  const [selectedIds, setSelectedIds] = useState([]);

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
    ]).then(([jobsRes, appsRes]) => {
      if (jobsRes.data) setJobs(jobsRes.data);
      if (appsRes.data) setApplicants(appsRes.data);
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
    return (
      <div style={container}>
        <button style={backBtn} onClick={() => setSelectedApplicant(null)}>
          ← Back to applicants
        </button>
        <div style={detailCard}>
          <h3 style={{ color: "#fff", marginBottom: "16px" }}>
            {selectedApplicant.full_name || "Unnamed"}
          </h3>
          {match && (
            <div style={scoreLarge}>
              <span style={aiBadge}>AI</span>{" "}
              Match: <strong>{match.score}%</strong> ({match.matched}/{match.total} skills)
            </div>
          )}
          {match?.explanation && (
            <div style={aiExplanation}>
              <strong>🤖 Gemini Analysis:</strong> {match.explanation}
            </div>
          )}
          {match?.basicScore !== undefined && match?.basicScore !== match?.score && (
            <div style={comparisonRow}>
              <span style={comparisonLabel}>🔍 Basic Match</span>
              <span style={comparisonValue}>{match.basicScore}%</span>
              <span style={comparisonArrow}>→</span>
              <span style={{ ...comparisonLabel, color: "#93c5fd" }}>🤖 AI Match</span>
              <span style={{ ...comparisonValue, color: "#93c5fd" }}>{match.score}%</span>
            </div>
          )}
          <div style={detailGrid}>
            <div style={detailItem}>
              <strong>Skills:</strong> {selectedApplicant.skills || "Not set"}
            </div>
            <div style={detailItem}>
              <strong>Location:</strong> {selectedApplicant.location || "Not set"}
            </div>
            <div style={detailItem}>
              <strong>Phone:</strong> {selectedApplicant.phone_number || "Not set"}
            </div>
            <div style={detailItem}>
              <strong>Bio:</strong> {selectedApplicant.bio || "Not set"}
            </div>
            {selectedApplicant.resume_url && (
              <div style={detailItem}>
                <strong>Resume:</strong>{" "}
                <a href={selectedApplicant.resume_url} target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>
                  View Resume ↗
                </a>
              </div>
            )}
            {match && match.matchedItems.length > 0 && (
              <div style={detailItem}>
                <strong>Matched Skills:</strong>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  {match.matchedItems.map((s) => (
                    <span key={s} style={matchBadge}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {match && match.missingItems.length > 0 && (
              <div style={detailItem}>
                <strong>Missing Skills:</strong>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  {match.missingItems.map((s) => (
                    <span key={s} style={missingBadge}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
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
                title={`Choose applicants to score against ${selectedJob?.title || "this job"}`}
                subtitle="Tick the people worth a Gemini call, or take the whole roster with Select all."
              />
            )
          ) : (
            <>
              <div style={resultsHead}>
                <span style={resultsTitle}>Ranked results</span>
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
const scoreLarge = {
  fontSize: "24px", fontWeight: "700", color: "#fff", marginBottom: "16px",
};
const detailGrid = { display: "flex", flexDirection: "column", gap: "12px" };
const detailItem = { fontSize: "13px", color: "rgba(255,255,255,0.85)", lineHeight: "1.6" };
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
