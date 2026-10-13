import { useEffect, useRef } from "react";
import ConsentDocument from "./ConsentDocument";

/**
 * "CJLink Consent Agreement" — the one place the agreement is shown.
 *
 * This is the ONLY opener: the link inside the checkbox label on BOTH Signup
 * forms (password and Google completion) points here, so the dialog cannot
 * drift apart between them. The separate "View Consent" button that used to
 * sit directly under that link did exactly the same thing and is gone.
 *
 * Reading it never ticks the checkbox, never navigates away and never loses
 * what the user already typed; it is a plain read-only view with one way out.
 * Escape and a backdrop click both close it, and focus is placed inside the
 * dialog on open so keyboard and screen-reader users land in the document
 * rather than behind it.
 *
 * Layout note — this used to be hard to read because it stacked a badge, a
 * title, a subtitle, a pill, six bordered sections, a green box and a button,
 * with two nested scrolling containers. Now there is exactly ONE scroll
 * region (the document) between a fixed header and a fixed footer, the text
 * is set at a readable size with real contrast, and everything is left
 * aligned so the paragraphs can be read like prose instead of centred captions.
 */
export default function ConsentModal({ open, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={backdrop}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="CJLink Consent Agreement"
        tabIndex={-1}
        style={panel}
      >
        <div style={head}>
          <span style={badge}>
            <ShieldGlyph />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={headTitle}>CJLink Consent Agreement</h3>
            <p style={headSub}>
              Everything you are agreeing to, in plain language. Effective on the date you accept it.
            </p>
          </div>
          {/* In the row, not absolutely positioned: an absolute ✕ overlapped
              the title as soon as it wrapped on a narrow phone. */}
          <button type="button" aria-label="Close" onClick={onClose} style={closeBtn}>
            ✕
          </button>
        </div>

        <div style={assurance}>
          <p style={assuranceTitle}>
            <CheckGlyph /> What this means for you
          </p>
          <ul style={assuranceList}>
            <li>Your profile and resume are shared only with employers you apply to.</li>
            <li>We never sell your data, and employers may only use it for hiring.</li>
            <li>You can correct or delete everything at any time — consent is not permanent.</li>
          </ul>
        </div>

        {/* The only scrolling container: header and footer stay put, so the
            document always has the full remaining height to itself. */}
        <div style={scrollArea}>
          <ConsentDocument />
        </div>

        <button type="button" onClick={onClose} style={doneBtn}>
          Done
        </button>
      </div>
    </div>
  );
}

/** Reassurance is the point of this screen, so the mark is a shield, not a gavel. */
function ShieldGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#86efac"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#86efac"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const backdrop = {
  position: "fixed", inset: 0, zIndex: 100,
  background: "rgba(2, 6, 23, 0.78)", backdropFilter: "blur(6px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
};
// Flex column with a fixed height ceiling: the header, the reassurance block
// and the Done button are pinned, and only the document scrolls between them.
const panel = {
  position: "relative", width: "100%", maxWidth: "600px",
  maxHeight: "88vh", overflow: "hidden", outline: "none",
  display: "flex", flexDirection: "column",
  background: "rgba(15, 23, 42, 0.98)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "18px", padding: "24px 24px 18px",
  boxShadow: "0 24px 70px rgba(0,0,0,0.6)", textAlign: "left",
};
const head = {
  display: "flex", alignItems: "flex-start", gap: "12px",
  marginBottom: "14px",
};
const closeBtn = {
  background: "none", border: "none", color: "rgba(255,255,255,0.6)",
  fontSize: "18px", cursor: "pointer", padding: "2px 6px",
  lineHeight: 1, flexShrink: 0, alignSelf: "flex-start", marginTop: "2px",
};
const badge = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0,
  background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
};
const headTitle = {
  color: "#fff", fontSize: "19px", fontWeight: "800", margin: "0 0 4px",
  letterSpacing: "0.1px",
};
// The subtitle carries the old "Effective on the date you accept it" pill as
// plain prose — one line of context instead of a second piece of chrome.
const headSub = {
  color: "rgba(255,255,255,0.6)", fontSize: "13px", lineHeight: "1.5", margin: "0",
};
const assurance = {
  borderRadius: "12px", padding: "12px 14px", marginBottom: "14px",
  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
};
const assuranceTitle = {
  display: "flex", alignItems: "center", gap: "6px", margin: "0 0 6px",
  color: "#86efac", fontSize: "12px", fontWeight: "700", textTransform: "uppercase",
  letterSpacing: "0.4px",
};
const assuranceList = {
  margin: "0", paddingLeft: "16px",
  color: "rgba(255,255,255,0.72)", fontSize: "13px", lineHeight: "1.65",
};
// flex:1 + minHeight:0 is what actually gives this box its share of the
// height instead of letting it push the Done button off the panel.
const scrollArea = {
  flex: 1, minHeight: 0, overflowY: "auto",
  paddingRight: "6px", marginRight: "-6px",
  // A visible, smooth scrollbar reads better than a disappearing one when
  // the reader is trying to judge how much is left.
  scrollbarWidth: "thin",
  scrollbarColor: "rgba(255,255,255,0.25) transparent",
};
const doneBtn = {
  width: "100%", padding: "11px", borderRadius: "10px", marginTop: "14px",
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)",
  cursor: "pointer", fontSize: "14px", fontWeight: "600",
  flexShrink: 0,
};
