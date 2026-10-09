// The consent wording, shared verbatim by /consent and the "View Consent"
// modal on Signup. One source so the text can never drift between the two —
// what the user reads before ticking the checkbox on Signup IS the document
// they accept on /consent.

export default function ConsentDocument() {
  return (
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
  );
}

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
