import { pageWrapper, button } from "../uiStyles";
import { useNavigate } from "react-router-dom";
import { colors, radii, shadows } from "../uiStyles";

export default function SelectRole() {
  const navigate = useNavigate();

  const handleSelection = (role) => {
    if (role === "admin") {
      navigate("/login", { state: { role: "admin" } });
    } else {
      navigate("/signup", { state: { role: "applicant" } });
    }
  };

  return (
    <div style={pageWrapper}>
      <div style={{ backgroundColor: "#fff", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", padding: "48px 40px", borderRadius: radii.xxl, width: "100%", maxWidth: "500px", boxShadow: shadows.xl, textAlign: "center", border: "1px solid rgba(255,255,255,0.5)" }}>
        <h2
          style={{
            fontSize: "28px",
            fontWeight: "800",
            color: colors.navy,
            marginBottom: "8px",
          }}
        >
          Select Your Role
        </h2>

        <p
          style={{
            marginBottom: "32px",
            color: colors.textSecondary,
            fontSize: "15px",
          }}
        >
          Are you an admin managing jobs or an applicant looking for work?
        </p>

        <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            style={{
              ...button,
              padding: "24px 40px",
              borderRadius: radii.xl,
              fontSize: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              background: colors.navy,
              minWidth: "160px",
            }}
            onClick={() => handleSelection("admin")}
          >
            <span style={{ fontSize: "32px" }}>👨‍💼</span>
            <span style={{ fontSize: "18px" }}>Admin</span>
            <span style={{ fontSize: "11px", fontWeight: "400", opacity: 0.8 }}>Sign in to manage</span>
          </button>

          <button
            style={{
              ...button,
              padding: "24px 40px",
              borderRadius: radii.xl,
              fontSize: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              background: colors.primaryDark,
              minWidth: "160px",
            }}
            onClick={() => handleSelection("applicant")}
          >
            <span style={{ fontSize: "32px" }}>🧑</span>
            <span style={{ fontSize: "18px" }}>Applicant</span>
            <span style={{ fontSize: "11px", fontWeight: "400", opacity: 0.8 }}>Find jobs & apply</span>
          </button>
        </div>

        <p style={{ marginTop: "24px", fontSize: "12px", color: colors.textSecondary }}>
          Admin accounts are created by the system administrator.
        </p>
      </div>
    </div>
  );
}
