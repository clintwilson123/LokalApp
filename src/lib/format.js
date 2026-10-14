/**
 * Interview and application date/time formatting, shared by the applicant's
 * MyApplications screen and the admin's record lists so a date never renders
 * one way for the person invited and another for the person who set it.
 */

/**
 * "2026-10-20" -> "Thursday, October 20, 2026".
 *
 * Parsed field by field on purpose. `new Date("2026-10-20")` is UTC midnight,
 * which in a timezone west of UTC renders as the 19th — the applicant would be
 * told to turn up a day early. Reading the parts and building a local date
 * sidesteps that entirely.
 */
export const formatDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
};

/** "2026-10-20" -> "Oct 20". Same timezone-safe parsing as formatDate. */
export const formatDateShort = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
};

/**
 * "14:30:00" -> "2:30 PM".
 *
 * The seconds PostgREST stores are dropped rather than parsed: an <input
 * type="time"> writes HH:MM and the column widens it to HH:MM:SS, so reading
 * only the first two parts keeps both shapes correct.
 */
export const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  if (Number.isNaN(h)) return String(t);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

/** "3 minutes ago", "5h ago", "2d ago", then a plain date past a week. */
export const relativeTime = (iso) => {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
