import { pageWrapper, card, title, input, button } from "../uiStyles";

export default function Signup() {
  return (
    <div style={pageWrapper}>
      <div style={{ ...card, maxWidth: "400px" }}>
        <h2 style={title}>Sign Up</h2>

        <input style={input} placeholder="Full Name" />
        <input style={input} placeholder="Email" />
        <input style={input} type="password" placeholder="Password" />

        <button style={{ ...button, width: "100%" }}>
          Create Account
        </button>
      </div>
    </div>
  );
}
