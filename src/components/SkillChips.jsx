import { useState } from "react";

/**
 * Skills as chips, with anything past the first few folded away.
 *
 * The applicant's skills arrive as one comma-joined string — which is fine
 * for two and unreadable for fifteen, the length of CJLink's catalog. Chips
 * are scannable, but fifteen chips are no better than fifteen words, so four
 * show by default and the rest wait behind a button that says how many it is
 * holding back.
 *
 * One copy for the whole app: the admin records table, the applicant's own
 * application detail, the user list and both applicant detail cards show the
 * same list and should fold it the same way. The limit is a prop so a table
 * cell can hold a shorter preview than a card with room to spare.
 */
const SKILL_CHIP_LIMIT = 4;

/**
 * @param {string|null|undefined} skills  The raw comma-separated column.
 * @param {number} [visible]              Preview length. The fold only renders
 *                                        when there is more than this to show.
 */
export default function SkillChips({ skills, visible = SKILL_CHIP_LIMIT }) {
  const [open, setOpen] = useState(false);
  const parts = String(skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) return <span style={muted}>Not set</span>;

  const hidden = parts.length - visible;
  const shown = open || hidden <= 0 ? parts : parts.slice(0, visible);

  return (
    <div style={chipWrap}>
      {shown.map((s) => (
        <span key={s} style={chip}>{s}</span>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          // The class carries the hover and focus states, which an inline
          // style cannot express — without them the control looked like one
          // more skill that happened to be clickable.
          className="skill-more-btn"
          onClick={() => setOpen((was) => !was)}
          aria-label={open ? "Show fewer skills" : `Show ${hidden} more skills`}
          aria-expanded={open}
          style={chipMore}
        >
          {open ? "Show less" : `+${hidden} more`}
        </button>
      )}
    </div>
  );
}

const muted = { color: "rgba(255,255,255,0.38)", fontStyle: "italic" };
const chipWrap = { display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" };
const chip = {
  fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "10px",
  backgroundColor: "rgba(45,212,191,0.11)", border: "1px solid rgba(45,212,191,0.22)",
  color: "#99f6e4", whiteSpace: "nowrap", lineHeight: "1.4",
};
const chipMore = {
  fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "10px",
  backgroundColor: "rgba(255,255,255,0.06)", border: "1px dashed rgba(255,255,255,0.22)",
  color: "rgba(255,255,255,0.6)", cursor: "pointer", whiteSpace: "nowrap",
  lineHeight: "1.4", fontFamily: "inherit",
};
