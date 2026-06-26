// Centralized theme — uses CSS custom properties for consistency.
// Where inline styles are unavoidable, reference these objects.

export const colors = {
  primary: "#4a90e2",
  primaryDark: "#1a73e8",
  primaryLight: "#d6e6f7",
  navy: "#1a3b5c",
  dark: "#0f172a",
  bg: "#f4f7fa",
  white: "#ffffff",
  text: "#333333",
  textSecondary: "#64748b",
  success: "#22c55e",
  warning: "#d97706",
  danger: "#f87171",
  border: "#e2eaf4",
  cardBg: "rgba(255, 255, 255, 0.6)",
};

export const radii = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
};

export const shadows = {
  sm: "0 2px 4px rgba(0, 0, 0, 0.02)",
  md: "0 4px 15px rgba(0, 0, 0, 0.08)",
  lg: "0 10px 30px rgba(0, 0, 0, 0.05)",
  xl: "0 15px 40px rgba(26, 59, 92, 0.08)",
};

// Shared component styles (used by Login / Signup / pages with centered cards)
export const pageWrapper = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100vh",
  backgroundColor: colors.bg,
  fontFamily: "'Inter', sans-serif",
  padding: "20px",
};

export const card = {
  backgroundColor: "#fff",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  padding: "50px",
  borderRadius: radii.xxl,
  width: "100%",
  maxWidth: "560px",
  boxShadow: shadows.xl,
  textAlign: "center",
  border: "1px solid rgba(255,255,255,0.5)",
};

export const title = {
  fontSize: "32px",
  fontWeight: "800",
  color: colors.navy,
  marginBottom: "15px",
  letterSpacing: "-0.5px",
};

export const input = {
  width: "100%",
  padding: "14px 16px",
  marginBottom: "15px",
  borderRadius: radii.sm,
  border: `1px solid ${colors.border}`,
  backgroundColor: "#fff",
  fontSize: "15px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

export const button = {
  padding: "14px 32px",
  backgroundColor: colors.primaryDark,
  color: "#fff",
  border: "none",
  borderRadius: radii.sm,
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "16px",
  transition: "all 0.2s",
};
