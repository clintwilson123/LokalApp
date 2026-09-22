import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { pageWrapper, card, title, subtitle, button } from "../uiStyles";

export default function Consent() {
  const navigate = useNavigate();
  const { user, loadProfile } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    if (!agreed) {
      setError("You must agree to the terms to continue.");
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
        <div style={{ fontSize: "42px", marginBottom: "8px" }}>📋</div>
        <h2 style={title}>Terms & Conditions</h2>
        <p style={subtitle}>Please read and accept the following</p>

        <div style={policyBox}>
          <h3 style={policyTitle}>Platform Terms</h3>
          <p style={policyText}>
            By using CJLink, you agree to provide accurate information in your profile and applications.
            You understand that employers may review your profile, resume, and application details.
          </p>

          <h3 style={policyTitle}>Privacy Policy</h3>
          <p style={policyText}>
            Your personal information (name, email, phone, skills, resume) is stored securely and only
            shared with employers you apply to. We do not sell your data to third parties.
          </p>

          <h3 style={policyTitle}>Employer Consent</h3>
          <p style={policyText}>
            Employers agree to use applicant information solely for hiring purposes. They will not
            share applicant data with unauthorized parties. All communication must be professional
            and related to job opportunities.
          </p>

          <h3 style={policyTitle}>Applicant Responsibilities</h3>
          <p style={policyText}>
            Applicants must maintain accurate profile information, respond to interview invitations
            promptly, and inform employers of any changes to their availability or qualifications.
          </p>
        </div>

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
          <span>I have read and agree to the Terms, Privacy Policy, and Employer Consent Agreement</span>
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
const policyBox = {
  backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "16px",
  marginBottom: "16px", border: "1px solid rgba(255,255,255,0.08)", textAlign: "left",
};
const policyTitle = {
  color: "#93c5fd", fontSize: "14px", fontWeight: "700", margin: "12px 0 4px",
};
const policyText = {
  color: "rgba(255,255,255,0.6)", fontSize: "12px", lineHeight: "1.6", margin: "0 0 8px",
};
const checkboxLabel = {
  display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px",
  color: "rgba(255,255,255,0.7)", cursor: "pointer", textAlign: "left",
};
