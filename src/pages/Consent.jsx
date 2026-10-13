import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { pageWrapper, card, title, subtitle, button } from "../uiStyles";
import ConsentDocument from "../components/ConsentDocument";

export default function Consent() {
  const navigate = useNavigate();
  const { user, loadProfile } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    if (!agreed) {
      setError("You must accept the CJLink Consent Agreement to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          consent_accepted: true,
          consent_accepted_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (updateError) throw updateError;
      await loadProfile(user.id);
      navigate("/find-jobs", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to save. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageWrapper}>
      <div style={{ ...blobStyle, width: "350px", height: "350px", background: "#4a90e2", top: "-5%", right: "-5%" }} />
      <div style={{ ...blobStyle, width: "250px", height: "250px", background: "#a78bfa", bottom: "-5%", left: "-5%" }} />

      <div style={{ ...card, maxWidth: "520px", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={badge}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#86efac"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <h2 style={title}>CJLink Consent Agreement</h2>
        <p style={subtitle}>Everything you are agreeing to, in plain language</p>

        <ConsentDocument />

        {error && (
          <div style={{
            padding: "10px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px",
            backgroundColor: "rgba(239,68,68,0.15)", color: "#fca5a5", textAlign: "center",
          }}>
            {error}
          </div>
        )}

        <label style={checkboxLabel}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => { setAgreed(e.target.checked); setError(""); }}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
          <span>I have read and agree to the CJLink Consent Agreement</span>
        </label>

        <button
          style={{ ...button, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer", marginTop: "16px" }}
          onClick={handleAccept}
          disabled={loading}
        >
          {loading ? "Saving..." : "Accept & Continue"}
        </button>
      </div>
    </div>
  );
}

const blobStyle = {
  position: "absolute", borderRadius: "50%", filter: "blur(80px)",
  opacity: 0.15, pointerEvents: "none", zIndex: 1,
};
// Same shield mark as the "View Consent" dialog, so the two surfaces read as
// one agreement rather than two different documents.
const badge = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: "44px", height: "44px", borderRadius: "14px", marginBottom: "12px",
  background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
};
const checkboxLabel = {
  display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px",
  color: "rgba(255,255,255,0.7)", cursor: "pointer", textAlign: "left",
};
