import { pageWrapper, card, title, button } from "../uiStyles";
import { useNavigate } from "react-router-dom";

export default function SelectRole() {
  const navigate = useNavigate();

  // Function to handle the navigation with role state
  const handleSelection = (role) => {
    // We send them to signup, passing the role in the background
    navigate("/signup", { state: { role } });
  };

  return (
    <div style={pageWrapper}>
      <div style={{ ...card, textAlign: "center", maxWidth: "500px" }}>
        <h2 style={title}>Select Your Role</h2>

        <p style={{ marginBottom: "25px", color: "#555" }}>
          Are you an admin managing jobs or an applicant looking for work?
        </p>

        <div style={{ display: "flex", gap: "20px", justifyContent: "center" }}>
          <button style={button} onClick={() => handleSelection("admin")}>
            👨‍💼 Admin
          </button>

          <button style={button} onClick={() => handleSelection("applicant")}>
            🧑 Applicant
          </button>
        </div>
      </div>
    </div>
  );
}