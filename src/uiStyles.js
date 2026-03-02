// uiStyles.js

export const colors = {
  background: "#eef1f6",
  focalBlue: "#d6e6f7", // The darker focal blue you requested
  navyText: "#1a3b5c",
  white: "#ffffff",
  textGray: "#4a5568",
};

// Add this missing export to fix the crash
export const input = {
  width: "100%",
  padding: "14px 16px",
  marginBottom: "15px",
  borderRadius: "12px",
  border: "1px solid #d1d9e6",
  backgroundColor: "#fcfdfe",
  fontSize: "15px",
  outline: "none"
};

export const pageWrapper = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100vh",
  backgroundColor: colors.background,
  fontFamily: "'Inter', sans-serif",
};

export const card = {
  backgroundColor: colors.focalBlue, // Saturated blue to attract the user
  padding: "50px",
  borderRadius: "32px", // Squircle geometry
  width: "100%",
  maxWidth: "560px",
  boxShadow: "0 15px 40px rgba(26, 59, 92, 0.08)",
  textAlign: "center"
};

export const title = {
  fontSize: "32px",
  fontWeight: "800",
  color: colors.navyText,
  marginBottom: "15px",
};

export const button = {
  padding: "16px 32px",
  backgroundColor: "#1a73e8",
  color: "#fff",
  border: "none",
  borderRadius: "16px",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "18px"
};