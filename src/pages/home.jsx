import { pageWrapper, card, title, button, colors } from "../uiStyles";
import { useNavigate } from "react-router-dom";
// Use relative path for src/images
import logo from "../images/image.png"; 

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={pageWrapper}>
      {/* Centered focal card with darker blue saturation */}
      <div style={card}>
        
        {/* Logo Squircle - Pure white to pop against the blue card */}
        <div style={logoContainer}>
          <img 
            src={logo} 
            alt="Logo" 
            style={{ width: "85%", height: "85%", objectFit: "contain" }} 
          />
        </div>

        <h1 style={title}>Your Local Job Hub</h1>
        <p style={{ marginBottom: "35px", color: colors.textGray, lineHeight: "1.6" }}>
          Connecting local companies with local talent in one platform.
        </p>

        <button 
          style={button} 
          onClick={() => navigate("/roles")}
        >
          Join Us Now
        </button>
      </div>
    </div>
  );
}

const logoContainer = {
  width: "130px",
  height: "130px",
  borderRadius: "32px",
  background: "#ffffff",
  margin: "0 auto 35px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.06)",
  overflow: "hidden"
};