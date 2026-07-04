export const colors = {
  primary: "#4a90e2",
  primaryDark: "#1a73e8",
  primaryLight: "#d6e6f7",
  navy: "#1a3b5c",
  dark: "#0f172a",
  bg: "linear-gradient(135deg, #0f172a 0%, #1a3b5c 50%, #1e4d7a 100%)",
  white: "#ffffff",
  text: "#1e293b",
  textSecondary: "#64748b",
  success: "#22c55e",
  warning: "#d97706",
  danger: "#ef4444",
  border: "#e2eaf4",
  inputBg: "#f8fafc",
};

export const radii = {
  sm: "10px",
  md: "14px",
  lg: "18px",
  xl: "24px",
  xxl: "32px",
};

export const shadows = {
  sm: "0 2px 4px rgba(0, 0, 0, 0.02)",
  md: "0 4px 15px rgba(0, 0, 0, 0.08)",
  lg: "0 10px 30px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 60px rgba(26, 59, 92, 0.15)",
};

export const pageWrapper = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100vh",
  background: colors.bg,
  fontFamily: "'Inter', sans-serif",
  padding: "20px",
  position: "relative",
  overflow: "hidden",
};

export const card = {
  backgroundColor: "rgba(255, 255, 255, 0.08)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  padding: "48px",
  borderRadius: radii.xxl,
  width: "100%",
  maxWidth: "440px",
  boxShadow: shadows.xl,
  textAlign: "center",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  position: "relative",
  zIndex: 2,
};

export const title = {
  fontSize: "28px",
  fontWeight: "800",
  color: colors.white,
  marginBottom: "8px",
  letterSpacing: "-0.5px",
};

export const subtitle = {
  color: "rgba(255, 255, 255, 0.6)",
  marginBottom: "32px",
  fontSize: "14px",
};

export const input = {
  width: "100%",
  padding: "14px 16px 14px 44px",
  marginBottom: "14px",
  borderRadius: radii.sm,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  backgroundColor: "rgba(255, 255, 255, 0.06)",
  color: "#fff",
  fontSize: "15px",
  outline: "none",
  boxSizing: "border-box",
  transition: "all 0.25s ease",
};

export const inputIcon = {
  position: "absolute",
  left: "16px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "rgba(255, 255, 255, 0.4)",
  fontSize: "18px",
  pointerEvents: "none",
};

export const inputWrapper = {
  position: "relative",
};

export const button = {
  padding: "14px 32px",
  background: "linear-gradient(135deg, #4a90e2, #1a73e8)",
  color: "#fff",
  border: "none",
  borderRadius: radii.sm,
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "16px",
  transition: "all 0.3s ease",
  width: "100%",
  marginTop: "6px",
  boxShadow: "0 4px 16px rgba(26, 115, 232, 0.3)",
};

export const link = {
  color: "rgba(255, 255, 255, 0.5)",
  fontSize: "13px",
  transition: "color 0.2s",
  textDecoration: "none",
};

export const linkHighlight = {
  color: "#60a5fa",
  fontWeight: "600",
  textDecoration: "none",
  transition: "color 0.2s",
};

export const dashCard = {
  backgroundColor: "rgba(255, 255, 255, 0.06)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  borderRadius: radii.xl,
  border: "1px solid rgba(255, 255, 255, 0.1)",
  padding: "24px",
  boxShadow: shadows.xl,
};

export const dashTitle = {
  fontSize: "20px",
  color: "#fff",
  fontWeight: "800",
  margin: "0 0 4px",
};

export const dashSubtitle = {
  fontSize: "13px",
  color: "rgba(255, 255, 255, 0.5)",
  margin: "0 0 20px",
};

export const dashLabel = {
  display: "block",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.5)",
  marginBottom: "4px",
  fontWeight: "500",
};

export const dashInput = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: radii.sm,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  backgroundColor: "rgba(255, 255, 255, 0.06)",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "'Inter', sans-serif",
};

export const dashSelect = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: radii.sm,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  backgroundColor: "rgba(255, 255, 255, 0.06)",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
};

export const dashTable = {
  backgroundColor: "rgba(255, 255, 255, 0.04)",
  borderRadius: radii.lg,
  padding: "16px",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  overflowX: "auto",
};

export const dashTh = {
  padding: "10px",
  color: "rgba(255, 255, 255, 0.5)",
  fontSize: "12px",
  fontWeight: "500",
  whiteSpace: "nowrap",
  textAlign: "left",
};

export const dashTd = {
  padding: "10px",
  fontSize: "13px",
  color: "rgba(255, 255, 255, 0.85)",
};

export const dashRow = {
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
};

export const dashStatCard = {
  flex: "1 1 120px",
  backgroundColor: "rgba(255, 255, 255, 0.06)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  padding: "14px",
  borderRadius: radii.md,
  display: "flex",
  alignItems: "center",
  gap: "12px",
  border: "1px solid rgba(255, 255, 255, 0.1)",
};

export const dashStatNum = {
  margin: 0,
  fontSize: "18px",
  color: "#fff",
};

export const dashStatLabel = {
  margin: 0,
  fontSize: "11px",
  color: "rgba(255, 255, 255, 0.5)",
};

export const dashBadge = (bg, color) => ({
  fontSize: "11px",
  padding: "3px 10px",
  borderRadius: "20px",
  fontWeight: "600",
  backgroundColor: bg,
  color,
});

export const dashSmallBtn = (color) => ({
  padding: "4px 8px",
  fontSize: "11px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: color + "20",
  color,
  cursor: "pointer",
  fontWeight: "600",
});

export const dashGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "12px",
};
