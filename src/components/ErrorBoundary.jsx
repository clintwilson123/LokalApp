import React from "react";
import { colors, radii } from "../uiStyles";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "60px 20px", textAlign: "center",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h2 style={{ color: colors.navy, fontSize: "20px", fontWeight: "800", marginBottom: "8px" }}>
            Something went wrong
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: "14px", maxWidth: "400px", marginBottom: "20px" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: "10px 24px", backgroundColor: colors.primaryDark, color: "#fff",
              border: "none", borderRadius: radii.sm, fontWeight: "700", cursor: "pointer", fontSize: "14px",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
