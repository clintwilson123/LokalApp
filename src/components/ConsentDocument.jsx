// The wording of the CJLink Consent Agreement, shown in full by the agreement
// dialog on Signup — the checkbox, the dialog and this text are the whole of
// it. There is no /consent page any more and no "Terms & Conditions" elsewhere
// in the app, so a person is never asked twice, under two titles, for the same
// agreement. The agreement link in the checkbox label is the only opener.
//
// The hiring policy that ApplyJob used to demand separately ("I agree to provide
// accurate information… consent to reviewing my profile, resume and application
// details… solely for hiring purposes… not shared with unauthorized parties")
// is folded into sections 1 and 3 here. Its content was a restatement of these
// sections, so it stays in ONE place — accepting this agreement at sign-up IS
// accepting the hiring policy. Do not re-add a second acknowledgment prompt.
//
// Set for reading, not for looking. The first version was 12px at 60% white
// with a rule under every section: dense, low-contrast, and read as a wall of
// terms nobody wants to open. Now it is 15px at 1.75 line-height in a light
// colour that clears contrast, with real air between sections and NO dividing
// rules — the numbered chips and headings carry the structure, so the eye
// scans six short sections instead of fighting a table.

export default function ConsentDocument() {
  return (
    <div style={policyBox}>
      <section style={section}>
        <h3 style={policyTitle}>
          <span style={number}>1</span> Platform Terms
        </h3>
        <p style={policyText}>
          By using CJLink, you agree to provide accurate and truthful information in your profile and
          applications. Providing false or misleading information may result in disqualification from
          a job, or removal from CJLink. You understand that employers may review your profile,
          resume, and application details solely for hiring purposes.
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

      <section style={{ ...section, marginBottom: 0 }}>
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

// No borders: spacing and the numbered chips do the separating. A rule under
// every paragraph turns six short sections into a grid, which is exactly the
// "wall of terms" feeling this screen is trying to avoid.
const section = {
  marginBottom: "22px",
};
const policyBox = {
  margin: 0,
};
const policyTitle = {
  color: "#93c5fd", fontSize: "16px", fontWeight: "700", margin: "0 0 8px",
  display: "flex", alignItems: "center", gap: "10px", lineHeight: "1.4",
};
// Numbered so a person can tell at a glance how much there is to read — a wall
// of undifferentiated paragraphs reads as "long and unskippable" and gets
// less careful attention, not more.
const number = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: "24px", height: "24px", flexShrink: 0, borderRadius: "7px",
  background: "rgba(74,144,226,0.2)", border: "1px solid rgba(74,144,226,0.35)",
  color: "#93c5fd", fontSize: "12px", fontWeight: "700",
};
const policyText = {
  color: "rgba(255,255,255,0.85)", fontSize: "15px", lineHeight: "1.75", margin: "0",
};
