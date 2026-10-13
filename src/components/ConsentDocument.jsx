// The consent wording, shared verbatim by /consent and the "View Consent"
// modal on Signup. One source so the text can never drift between the two —
// what the user reads before ticking the checkbox on Signup IS the document
// they accept on /consent.
//
// It is ONE document under ONE name: the CJLink Consent Agreement. There is no
// separate "Terms & Conditions" to accept anywhere in the app, so a person is
// never asked twice, under two titles, for the same agreement.

export default function ConsentDocument() {
  return (
    <div style={policyBox}>
      <section style={section}>
        <h3 style={policyTitle}>
          <span style={number}>1</span> Platform Terms
        </h3>
        <p style={policyText}>
          By using CJLink, you agree to provide accurate information in your profile and applications.
          You understand that employers may review your profile, resume, and application details.
        </p>
      </section>

      <section style={section}>
        <h3 style={policyTitle}>
          <span style={number}>2</span> Privacy Policy
        </h3>
        <p style={policyText}>
          Your personal information (name, email, phone, skills, resume) is stored securely and only
          shared with employers you apply to. We do not sell your data to third parties.
        </p>
      </section>

      <section style={section}>
        <h3 style={policyTitle}>
          <span style={number}>3</span> Employer Consent
        </h3>
        <p style={policyText}>
          Employers agree to use applicant information solely for hiring purposes. They will not
          share applicant data with unauthorized parties. All communication must be professional
          and related to job opportunities.
        </p>
      </section>

      <section style={section}>
        <h3 style={policyTitle}>
          <span style={number}>4</span> Applicant Responsibilities
        </h3>
        <p style={policyText}>
          Applicants must maintain accurate profile information, respond to interview invitations
          promptly, and inform employers of any changes to their availability or qualifications.
        </p>
      </section>

      <section style={section}>
        <h3 style={policyTitle}>
          <span style={number}>5</span> Your Data Rights
        </h3>
        <p style={policyText}>
          Your profile belongs to you. You can view and correct anything in it at any time, and you
          can request deletion of your account and everything tied to it. Closing your account
          removes your profile and applications from CJLink.
        </p>
      </section>

      <section style={section}>
        <h3 style={policyTitle}>
          <span style={number}>6</span> Consent and Withdrawal
        </h3>
        <p style={policyText}>
          This agreement is recorded with the date you accept it. You may withdraw it at any time by
          deleting your account — accepting is never a one-way door, and you are never locked into
          using CJLink.
        </p>
      </section>
    </div>
  );
}

const section = {
  paddingBottom: "10px",
  marginBottom: "10px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const policyBox = {
  backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "16px",
  marginBottom: "16px", border: "1px solid rgba(255,255,255,0.08)", textAlign: "left",
};
const policyTitle = {
  color: "#93c5fd", fontSize: "14px", fontWeight: "700", margin: "0 0 6px",
  display: "flex", alignItems: "center", gap: "8px",
};
// Numbered so a person can tell at a glance how much there is to read — a wall
// of undifferentiated paragraphs reads as "long and unskippable" and gets
// less careful attention, not more.
const number = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: "20px", height: "20px", flexShrink: 0, borderRadius: "6px",
  background: "rgba(74,144,226,0.2)", border: "1px solid rgba(74,144,226,0.35)",
  color: "#93c5fd", fontSize: "11px", fontWeight: "700",
};
const policyText = {
  color: "rgba(255,255,255,0.6)", fontSize: "12px", lineHeight: "1.6", margin: "0",
};
