import { pageWrapper, card, title, button } from "../uiStyles";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={pageWrapper}>
      <div style={{ ...card, textAlign: "center", maxWidth: "520px" }}>
        <div
          style={{
            width: "110px",
            height: "110px",
            borderRadius: "50%",
            border: "4px solid #1d4ed8",
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "700",
            fontSize: "24px",
            color: "#1d4ed8"
          }}
        >
          Lokal
        </div>

        <h1 style={title}>Your Local Job Hub</h1>
        <p style={{ marginBottom: "25px", color: "#555" }}>
          Connecting local companies with local talent in one platform.
        </p>

        <button style={button} onClick={() => navigate("/roles")}>
          Join Us Now
        </button>
      </div>
    </div>
  );
}
