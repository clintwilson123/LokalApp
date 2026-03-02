import { useLocation, useNavigate, Link } from "react-router-dom";
import { pageWrapper, card, title, input, button } from "../uiStyles";

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Capture the role passed from SelectRole -> Signup -> Login
  // If someone goes directly to /login, it defaults to "applicant"
  const role = location.state?.role || "applicant";

  const handleLogin = () => {
    // 2. Direct the user based on the role state
    if (role === "admin") {
      navigate("/admin-dashboard");
    } else {
      navigate("/find-jobs"); // or wherever your applicant home is
    }
  };

  return (
    <div style={pageWrapper}>
      <div style={{ ...card, maxWidth: "400px" }}>
        {/* Dynamic Title based on role */}
        <h2 style={title}>Login as {role.charAt(0).toUpperCase() + role.slice(1)}</h2>

        <input style={input} placeholder="Email" />
        <input style={input} type="password" placeholder="Password" />

        <button 
          style={{ ...button, width: "100%" }} 
          onClick={handleLogin}
        >
          Login
        </button>

        <p style={{ marginTop: "15px", textAlign: "center" }}>
          Don’t have an account? <Link to="/signup" state={{ role }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}