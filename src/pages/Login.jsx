import { pageWrapper, card, title, input, button } from "../uiStyles";
import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div style={pageWrapper}>
      <div style={{ ...card, maxWidth: "400px" }}>
        <h2 style={title}>Login</h2>

        <input style={input} placeholder="Email" />
        <input style={input} type="password" placeholder="Password" />

        <button style={{ ...button, width: "100%" }}>Login</button>

        <p style={{ marginTop: "15px", textAlign: "center" }}>
          Don’t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
