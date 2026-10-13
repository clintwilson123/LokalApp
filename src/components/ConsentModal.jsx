import { useEffect, useRef } from "react";
import ConsentDocument from "./ConsentDocument";

/**
 * "View Consent" — the one place the CJLink Consent Agreement is shown.
 *
 * Used by BOTH Signup forms (password and Google completion), so the dialog
 * cannot drift apart between them. Reading it never ticks the checkbox, never
 * navigates away and never loses what the user already typed; it is a plain
 * read-only view with one way out.
 *
 * Escape and a backdrop click both close it, and focus is placed inside the
 * dialog on open so keyboard and screen-reader users land in the document
 * rather than behind it.
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
        <button type="button" aria-label="Close" onClick={onClose} style={closeBtn}>
          ✕
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <span style={badge}>
            <ShieldGlyph />
          </span>
          <div>
            <h3 style={{ color: "#fff", fontSize: "20px", fontWeight: "800", margin: "0 0 4px" }}>
              CJLink Consent Agreement
            </h3>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", margin: "0" }}>
              Everything you are agreeing to, in plain language
            </p>
          </div>
          <span style={effective}>Effective on the date you accept it</span>
        </div>

        <div style={{ maxHeight: "42vh", overflowY: "auto", paddingRight: "4px" }}>
          <ConsentDocument />
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
const panel = {
  position: "relative", width: "100%", maxWidth: "540px",
  maxHeight: "86vh", overflowY: "auto", outline: "none",
  background: "rgba(15, 23, 42, 0.98)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "18px", padding: "28px 24px 20px",
  boxShadow: "0 24px 70px rgba(0,0,0,0.6)", textAlign: "center",
};
const closeBtn = {
  position: "absolute", top: "10px", right: "12px",
  background: "none", border: "none", color: "rgba(255,255,255,0.6)",
  fontSize: "18px", cursor: "pointer", padding: "4px 8px",
};
const badge = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: "44px", height: "44px", borderRadius: "14px",
  background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
};
const effective = {
  display: "inline-block", padding: "4px 12px", borderRadius: "999px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: "600",
  letterSpacing: "0.2px",
};
const assurance = {
  textAlign: "left", borderRadius: "12px", padding: "12px 14px", marginBottom: "14px",
  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
};
const assuranceTitle = {
  display: "flex", alignItems: "center", gap: "6px", margin: "0 0 6px",
  color: "#86efac", fontSize: "12px", fontWeight: "700", textTransform: "uppercase",
  letterSpacing: "0.4px",
};
const assuranceList = {
  margin: "0", paddingLeft: "16px",
  color: "rgba(255,255,255,0.65)", fontSize: "12px", lineHeight: "1.7",
};
const doneBtn = {
  width: "100%", padding: "11px", borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)",
  cursor: "pointer", fontSize: "14px", fontWeight: "600",
};
