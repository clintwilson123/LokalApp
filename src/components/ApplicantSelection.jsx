import { useMemo } from "react";
import { radii } from "../uiStyles";

/**
 * Who gets Gemini quota spent on them used to be an all-or-nothing choice.
 * An employer with 40 applicants who already knew they wanted to hear about
 * three of them had no way to say so.
 *
 * This component is the picker for that decision. It owns the checkbox grid,
 * the Select all / Clear controls, and the whole action band; it deliberately
 * does NOT own the scan itself — the page decides what a click means, because
 * the two pages that need this keep their rosters in different shapes (Manage
 * Jobs ranks a job's actual applicants, Manage Applicants ranks every
 * registered profile). That is why Quick scan and Scan all arrive as
 * callbacks rather than being built in: only one of the two pages has a free
 * local pre-ranker to put behind them.
 *
 * Layout, top to bottom: what this panel is → the selection controls → the
 * people themselves → every way of starting a scan. Four bands, so the eye
 * always knows whether it is reading a heading, a control, data or a
 * decision. Keeping the three scan buttons in the one decision band is what
 * stops them reading as three unrelated affordances scattered down the page.
 */

/**
 * The action button. Its label carries the live count because the number of
 * people about to be charged to quota is the single fact most worth having in
 * front of you before you press it.
 */
export function AnalyzeSelectedButton({ count, onClick, disabled = false }) {
  const off = disabled || count === 0;
  return (
    <button className="cjlink-pick-cta" style={ctaStyle} onClick={onClick} disabled={off}>
      Analyze Selected Applicants ({count})
    </button>
  );
}

/** "Excel, Word, React" -> ["Excel", "Word", "React"]. Never throws on null. */
function skillList(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** How many skills a card shows before folding the rest into a "+N". */
const SKILL_PREVIEW = 3;

/**
 * @param {Array}    items        Roster to pick from. Each entry needs a stable `id`.
 * @param {string[]} selectedIds  The current selection.
 * @param {(ids: string[]) => void} onChange  Receives a NEW array — never mutate in place.
 * @param {() => void} [onAnalyze] The counted action for the ticked people.
 * @param {() => void} [onScanAll] Whole-roster action. Ignoring the selection
 *                                 is the point of it, so it never reads the count.
 * @param {() => void} [onQuickScan] Whole-roster action backed by the free local
 *                                   pre-ranker. Manage Jobs only — the other page
 *                                   ranks profiles that have no job to match against.
 * @param {string}    [quickScanLabel] Its button text; the caller owns the number.
 */
export default function ApplicantSelection({
  items,
  selectedIds,
  onChange,
  onAnalyze,
  analyzeLabel,
  onScanAll,
  onQuickScan,
  quickScanLabel,
  title = "Choose applicants to score",
  subtitle,
  emptyMessage = "No applicants to pick from yet.",
  disabled = false,
}) {
  // Memoized, not just `items || []`: the three useMemo's below key off this,
  // and a fresh identity on every render would defeat memoizing them.
  const list = useMemo(() => items || [], [items]);

  // Derived once per render, not once per card. The naive version —
  // `selectedIds.includes(id)` inside the map — is O(rows × selection) on
  // every click, and this grid re-renders on each tick of the selection itself.
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(() => list.map((p) => p.id), [list]);

  const total = list.length;
  const picked = selectedSet.size;
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id));

  const toggleOne = (id) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  if (total === 0) {
    return <p style={emptyText}>{emptyMessage}</p>;
  }

  return (
    <section className="cjlink-pick" style={panel} aria-label={title}>
      <header style={panelHead}>
        <div style={{ minWidth: 0 }}>
          <h3 style={panelTitle}>{title}</h3>
          {subtitle && <p style={panelSub}>{subtitle}</p>}
        </div>
        {/* ONE text node, not a <strong> around the number: React would put
            the number in a child element, and anything reading this pill — a
            test, a screen reader, a string search — would then have to
            reassemble it from pieces. */}
        <span style={countPill}>{`${picked} of ${total} selected`}</span>
      </header>

      <div style={toolbar}>
        <button
          className="cjlink-pick-btn"
          style={ghostBtn}
          onClick={() => onChange(allSelected ? [] : allIds)}
          disabled={disabled}
        >
          {allSelected ? "Clear all" : `Select all ${total}`}
        </button>
        <button
          className="cjlink-pick-btn"
          style={ghostBtn}
          onClick={() => onChange([])}
          disabled={disabled || picked === 0}
        >
          Clear
        </button>
        <span style={toolbarRule} aria-hidden="true" />
        <span style={toolbarHint}>
          {picked === 0 ? "Nothing selected" : `${picked} of ${total} ready to scan`}
        </span>
      </div>

      <div style={grid}>
        {list.map((person, index) => {
          const on = selectedSet.has(person.id);
          const skills = skillList(person.skills);
          return (
            <label
              key={person.id}
              className={`cjlink-pick-card${on ? " is-on" : ""}`}
              style={card(on)}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggleOne(person.id)}
                disabled={disabled}
                aria-label={`Analyze ${person.full_name || "Unnamed"}`}
                style={checkbox}
              />
              <span style={cardBody}>
                <span style={cardTop}>
                  <span style={cardName(on)}>{person.full_name || "Unnamed"}</span>
                  {/* The 1-based position, so the row order is countable
                      against the "N of M" tally above. */}
                  <span style={cardIndex}>{index + 1}</span>
                </span>
                <span style={cardMeta}>{person.location || "No location set"}</span>
                {skills.length > 0 && (
                  <span style={chipRow}>
                    {skills.slice(0, SKILL_PREVIEW).map((s) => (
                      <span key={s} style={chip(on)}>
                        {s}
                      </span>
                    ))}
                    {skills.length > SKILL_PREVIEW && (
                      <span style={chipMore}>{`+${skills.length - SKILL_PREVIEW}`}</span>
                    )}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {/* The decision band. All three ways of starting a scan live here and
          nowhere else: ticked people, the whole roster, or the pre-ranked
          slice. Splitting them up the page made each one look like a
          different feature rather than a different scope of the same one. */}
      <footer style={panelFoot}>
        <span style={footHint}>
          {picked === 0
            ? "Tick applicants above — or scan the whole roster."
            : "Your selection is kept — change it and run again any time."}
        </span>
        <div style={footActions}>
          {onQuickScan && (
            <button
              className="cjlink-pick-btn"
              style={ghostBtn}
              onClick={onQuickScan}
              disabled={disabled}
            >
              {quickScanLabel || "Quick scan"}
            </button>
          )}
          {onScanAll && (
            <button
              className="cjlink-pick-btn"
              style={ghostBtn}
              onClick={onScanAll}
              disabled={disabled}
            >
              🧠 Scan all {total}
            </button>
          )}
          {onAnalyze && (
            <button
              className="cjlink-pick-cta"
              style={ctaStyle}
              onClick={onAnalyze}
              disabled={disabled || picked === 0}
            >
              {analyzeLabel || "Analyze Selected Applicants"} ({picked})
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}

/* ── Panel ───────────────────────────────────────────────────────────
   Interaction states (hover, focus rings, transitions) live in styles.css
   under `.cjlink-pick-*`, because inline styles cannot express them — the
   same split `.cjlink-google-btn` already uses. Everything below is the
   static contract: colours, spacing, type. */

const panel = {
  backgroundColor: "rgba(15,23,42,0.55)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: radii.lg,
  padding: "20px",
  margin: "0 0 14px",
};
const panelHead = {
  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
  gap: "16px", flexWrap: "wrap",
  paddingBottom: "14px", marginBottom: "14px",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};
const panelTitle = {
  color: "#fff", fontWeight: "700", fontSize: "15px", margin: 0, lineHeight: 1.35,
};
const panelSub = {
  color: "rgba(255,255,255,0.5)", fontSize: "12.5px", lineHeight: 1.55,
  margin: "5px 0 0", maxWidth: "62ch",
};
const countPill = {
  flexShrink: 0, fontSize: "12.5px", fontWeight: "700", letterSpacing: "0.2px",
  color: "#bfdbfe",
  backgroundColor: "rgba(74,144,226,0.16)",
  border: "1px solid rgba(74,144,226,0.38)",
  borderRadius: "20px", padding: "6px 13px", whiteSpace: "nowrap",
};

const toolbar = {
  display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "14px",
};
const ghostBtn = {
  backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.16)",
  color: "rgba(255,255,255,0.82)", padding: "7px 14px", borderRadius: "8px",
  fontSize: "12.5px", fontWeight: "600",
};
// The rules below are the divider between the bulk controls and the live
// status, so the two never read as one run of buttons.
const toolbarRule = {
  width: "1px", height: "16px", backgroundColor: "rgba(255,255,255,0.14)",
  margin: "0 2px",
};
const toolbarHint = { fontSize: "12.5px", color: "rgba(255,255,255,0.45)" };

const grid = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "10px",
};
const card = (on) => ({
  display: "flex", alignItems: "flex-start", gap: "11px",
  padding: "12px 13px", borderRadius: radii.md, cursor: "pointer",
  backgroundColor: on ? "rgba(74,144,226,0.15)" : "rgba(255,255,255,0.045)",
  border: `1px solid ${on ? "rgba(74,144,226,0.55)" : "rgba(255,255,255,0.1)"}`,
});
// Accent colour so the native box is visible on the dark surface instead of
// the browser's default near-invisible grey tick.
const checkbox = {
  width: "17px", height: "17px", flexShrink: 0,
  accentColor: "#4a90e2", cursor: "pointer", margin: "1px 0 0",
};
const cardBody = { minWidth: 0, flex: 1, display: "block" };
const cardTop = { display: "flex", alignItems: "center", gap: "8px" };
const cardName = (on) => ({
  flex: 1, minWidth: 0, fontSize: "13.5px", fontWeight: "700",
  color: on ? "#fff" : "rgba(255,255,255,0.9)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
});
const cardIndex = {
  flexShrink: 0, fontSize: "10px", fontWeight: "700", color: "rgba(255,255,255,0.35)",
  backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "5px", padding: "2px 6px",
  fontVariantNumeric: "tabular-nums",
};
const cardMeta = {
  display: "block", fontSize: "11.5px", color: "rgba(255,255,255,0.45)",
  marginTop: "3px", lineHeight: 1.4,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
// Skills are why an employer can decide at all — a name and a town say
// nothing about whether this person is worth a Gemini call.
const chipRow = { display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "8px" };
const chip = (on) => ({
  fontSize: "10.5px", fontWeight: "600", padding: "3px 8px", borderRadius: "20px",
  color: on ? "#dbeafe" : "#93c5fd",
  backgroundColor: on ? "rgba(74,144,226,0.3)" : "rgba(74,144,226,0.14)",
  border: `1px solid ${on ? "rgba(74,144,226,0.5)" : "rgba(74,144,226,0.26)"}`,
  maxWidth: "100%",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
});
const chipMore = {
  fontSize: "10.5px", fontWeight: "700", padding: "3px 7px", borderRadius: "20px",
  color: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.06)",
  alignSelf: "center",
};

const panelFoot = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: "14px", flexWrap: "wrap",
  marginTop: "16px", paddingTop: "14px",
  borderTop: "1px solid rgba(255,255,255,0.07)",
};
const footHint = { fontSize: "12.5px", color: "rgba(255,255,255,0.45)" };
// The two whole-roster buttons are ghost and the counted one is solid, so the
// action that actually charges quota for a specific, chosen number of people
// is the one that looks like the decision.
const footActions = {
  display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap",
};
const ctaStyle = {
  backgroundColor: "#4a90e2", border: "1px solid #4a90e2", color: "#fff",
  padding: "11px 20px", borderRadius: "9px", fontSize: "13.5px", fontWeight: "700",
};

const emptyText = {
  color: "rgba(255,255,255,0.5)", textAlign: "center",
  padding: "32px 14px", fontSize: "13px",
  backgroundColor: "rgba(15,23,42,0.55)",
  border: "1px dashed rgba(255,255,255,0.16)",
  borderRadius: radii.lg,
};
