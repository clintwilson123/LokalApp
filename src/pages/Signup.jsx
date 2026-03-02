import { pageWrapper, card, title, input, button } from "../uiStyles";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const role = location.state?.role || "applicant";

  // BLOCK ADMIN SIGNUP: Redirect to login if they try to access signup as admin
  if (role === "admin") {
    return <Navigate to="/login" state={{ role: "admin" }} replace />;
  }

  const handleSignup = () => {
    navigate("/login", { state: { role: role } });
  };

  return (
    <div style={pageWrapper}>
      <div style={{ ...card, maxWidth: "400px" }}>
        <h2 style={title}>Sign Up ({role.charAt(0).toUpperCase() + role.slice(1)})</h2>

        <input style={input} placeholder="Full Name" />
        <input style={input} placeholder="Email" />
        <input style={input} type="password" placeholder="Password" />

        <button style={{ ...button, width: "100%" }} onClick={handleSignup}>
          Create Account
        </button>

        <p style={{ marginTop: "15px", textAlign: "center" }}>
          Already have an account? <Link to="/login" state={{ role }}>Login</Link>
        </p>
      </div>
    </div>
  );
}