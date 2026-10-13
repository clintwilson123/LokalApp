import { useEffect, useId, useRef, useState } from "react";
import { radii } from "../uiStyles";

/**
 * The searchable, chip-building skill selector.
 *
 * Extracted from Profile.jsx, where it existed only for applicants. It is now
 * used on BOTH sides — applicants pick what they can do, admins pick what a
 * job requires — because the two sides have to draw from the same vocabulary
 * for any matching to mean anything. One component, one set of behaviours.
 *
 * Reads and writes a plain `string[]`, so callers keep whatever storage they
 * already use (applicants store CSV on profiles.skills, the job form stores
 * the jobs.requirements array).
 *
 * `allowCustom` is the admin escape hatch: a skill that is not in the catalog
 * yet can still be used, rather than blocking a posting on a missing entry.
 */
export default function SkillPicker({
  selected = [],
  onChange,
  options = [],
  grouped = null,
  allowCustom = false,
  onCreateCustom,
  placeholder = "Select skills...",
  emptyMessage = "No skills available yet.",
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  // Click-outside. The dropdown is portalled nowhere — it is absolutely
  // positioned inside this wrapper — so the wrapper bounds are enough.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Focus the search box on open so typing works immediately, and keep the
  // list reachable from the keyboard.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Escape closes from anywhere, not only from inside the dropdown — the same
  // contract the consent dialog uses. Relying on the focused input alone
  // breaks the moment focus moves.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function toggle(skill) {
    onChange(
      selected.includes(skill) ? selected.filter((s) => s !== skill) : [...selected, skill]
    );
  }

  function remove(skill) {
    onChange(selected.filter((s) => s !== skill));
  }

  const needle = term.trim().toLowerCase();
  const matches = (s) => s.toLowerCase().includes(needle);
  const flatOptions = options.length ? options : (grouped || []).flatMap((g) => g.skills);
  const exactExists = flatOptions.some((s) => s.toLowerCase() === needle);
  const canAddCustom =
    allowCustom && needle.length > 0 && !exactExists && typeof onCreateCustom === "function";

  // Group headers only help when browsing; while searching, one flat list is
  // easier to scan than sections that each contain a single hit.
  const visibleGroups =
    !needle && grouped && grouped.length
      ? grouped
      : [{ category: null, skills: flatOptions.filter(matches) }];

  const anyVisible = visibleGroups.some((g) => g.skills.length > 0);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div
        id={id}
        role="button"
        tabIndex={0}
        // A stable accessible name. Without it the button is announced as its
        // own contents ("Excel ✕ Teamwork ✕ 2 ▼"), which says nothing about
        // what the control is for.
        aria-label={placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        style={trigger}
      >
        {selected.length === 0 ? (
          <span style={placeholderText}>{placeholder}</span>
        ) : (
          <>
            <div style={tagRow}>
              {selected.slice(0, 3).map((s) => (
                <span key={s} style={tag}>
                  {s}
                  <span
                    role="button"
                    aria-label={`Remove ${s}`}
                    style={tagRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(s);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        remove(s);
                      }
                    }}
                  >
                    ✕
                  </span>
                </span>
              ))}
              {selected.length > 3 && <span style={moreTag}>+{selected.length - 3}</span>}
            </div>
            <span style={countBadge}>{selected.length}</span>
          </>
        )}
        <span style={caret}>▼</span>
      </div>

      {open && (
        <div role="listbox" aria-multiselectable="true" style={dropdown}>
          <div style={searchWrap}>
            <span style={searchIcon}>🔍</span>
            <input
              ref={searchRef}
              style={searchInput}
              placeholder="Search skills..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
            {term && (
              <button type="button" style={searchClear} onClick={() => setTerm("")} aria-label="Clear search">
                ✕
              </button>
            )}
          </div>

          <div style={listHeader}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
              {selected.length} selected
            </span>
            {selected.length > 0 && (
              <button type="button" style={clearAll} onClick={() => onChange([])}>
                Clear All
              </button>
            )}
          </div>

          <div style={listScroll}>
            {!anyVisible && !canAddCustom && (
              <div style={emptyRow}>{needle ? `No skills match "${term.trim()}"` : emptyMessage}</div>
            )}

            {visibleGroups.map((group) =>
              group.skills.length === 0 ? null : (
                <div key={group.category || "all"}>
                  {group.category && <div style={groupHeader}>{group.category}</div>}
                  {group.skills.map((skill) => (
                    <label key={skill} style={option}>
                      <input
                        type="checkbox"
                        checked={selected.includes(skill)}
                        onChange={() => toggle(skill)}
                        style={{ accentColor: "#4a90e2" }}
                      />
                      <span>{skill}</span>
                    </label>
                  ))}
                </div>
              )
            )}

            {canAddCustom && (
              <button
                type="button"
                style={addCustom}
                onClick={() => {
                  onCreateCustom(term.trim());
                  setTerm("");
                }}
              >
                + Add “{term.trim()}”
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const trigger = {
  display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px",
  minHeight: "44px", padding: "8px 12px", borderRadius: radii.sm,
  border: "1px solid rgba(255,255,255,0.15)",
  backgroundColor: "rgba(255,255,255,0.06)", color: "#fff",
  fontSize: "14px", cursor: "pointer", boxSizing: "border-box", textAlign: "left",
};
const placeholderText = { color: "rgba(255,255,255,0.3)", fontSize: "14px" };
const tagRow = { display: "flex", flexWrap: "wrap", gap: "4px", flex: 1 };
const tag = {
  display: "inline-flex", alignItems: "center", gap: "4px",
  fontSize: "12px", padding: "3px 8px", borderRadius: "6px",
  backgroundColor: "rgba(74,144,226,0.2)", color: "#93c5fd", fontWeight: "500",
};
const moreTag = {
  fontSize: "12px", padding: "3px 8px", borderRadius: "6px",
  backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)",
};
const tagRemove = { cursor: "pointer", fontSize: "10px", marginLeft: "2px", opacity: 0.7, lineHeight: "1" };
const countBadge = {
  marginLeft: "auto", fontSize: "11px", fontWeight: "700", padding: "2px 8px",
  borderRadius: "10px", backgroundColor: "rgba(74,144,226,0.3)", color: "#93c5fd",
};
const caret = { marginLeft: "4px", color: "rgba(255,255,255,0.3)", fontSize: "12px" };

const dropdown = {
  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
  marginTop: "4px", borderRadius: radii.sm, overflow: "hidden",
  backgroundColor: "rgba(15,23,42,0.98)", border: "1px solid rgba(255,255,255,0.15)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};
// The list scrolls, the search box and the "N selected" row stay put.
const listScroll = { maxHeight: "200px", overflowY: "auto" };
const searchWrap = {
  position: "relative", zIndex: 1, backgroundColor: "rgba(15,23,42,0.98)",
  padding: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)",
};
const searchIcon = {
  position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)",
  fontSize: "13px", opacity: 0.4, pointerEvents: "none",
};
const searchInput = {
  width: "100%", padding: "8px 28px 8px 32px", borderRadius: "6px",
  border: "1px solid rgba(255,255,255,0.12)", fontSize: "13px", outline: "none",
  boxSizing: "border-box", backgroundColor: "rgba(255,255,255,0.06)", color: "#fff",
  fontFamily: "'Inter', sans-serif",
};
const searchClear = {
  position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer",
  fontSize: "12px", padding: "2px",
};
const listHeader = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const clearAll = {
  background: "none", border: "none", color: "#fca5a5", cursor: "pointer",
  fontSize: "12px", fontWeight: "600", padding: "2px 6px",
};
const groupHeader = {
  padding: "7px 14px 4px", fontSize: "11px", fontWeight: "700",
  letterSpacing: "0.4px", color: "rgba(255,255,255,0.35)",
  textTransform: "uppercase", position: "sticky", top: 0,
  backgroundColor: "rgba(15,23,42,0.98)",
};
const option = {
  display: "flex", alignItems: "center", gap: "8px",
  padding: "8px 14px", cursor: "pointer", fontSize: "13px", color: "rgba(255,255,255,0.85)",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};
const emptyRow = { padding: "12px 14px", color: "rgba(255,255,255,0.4)", fontSize: "13px" };
const addCustom = {
  display: "block", width: "100%", textAlign: "left", padding: "9px 14px",
  background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.06)",
  color: "#93c5fd", fontSize: "13px", fontWeight: "600", cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
};
