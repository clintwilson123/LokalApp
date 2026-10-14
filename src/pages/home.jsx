import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Six identical blue tiles gave a visitor no reason to read one rather than
 * another — the same problem the admin overview had. Each card now carries
 * its own accent on the icon tile and the left rule, so the grid reads as
 * six different things.
 */
const features = [
  {
    icon: "💼",
    accent: "#60a5fa",
    title: "Browse Open Roles",
    desc: "Every position at CJTECH Computer Trading — sales, technical support and the rest — in one searchable list.",
  },
  {
    icon: "🎯",
    accent: "#a78bfa",
    title: "Skill Match Scoring",
    desc: "Each job is scored against the skills on your profile, so you can see where you fit before you spend time applying.",
  },
  {
    icon: "📄",
    accent: "#34d399",
    title: "Apply With Your Resume",
    desc: "Upload your resume once, then apply to any role with a single click.",
  },
  {
    icon: "🔔",
    accent: "#fbbf24",
    title: "Track Every Application",
    desc: "Follow each application from submitted to hired, and see your interview date, time and location the moment they are set.",
  },
  {
    icon: "👥",
    accent: "#f472b6",
    title: "Built for Employers",
    desc: "Post a role, compare applicants side by side with match scores, and schedule interviews from one dashboard.",
  },
  {
    icon: "🛡️",
    accent: "#22d3ee",
    title: "Scoped to You",
    desc: "Row-level security keeps your profile, resume and application history between you and the CJTECH hiring team.",
  },
];

/** The three questions a first-time visitor actually arrives with. */
const steps = [
  {
    n: "1",
    title: "Create your profile",
    desc: "Add your skills, contact details and resume once. CJLink keeps them for every role you apply to.",
  },
  {
    n: "2",
    title: "Apply to open roles",
    desc: "See a match score on each job, then apply in a single click — no forms to retype, no emails to send.",
  },
  {
    n: "3",
    title: "Follow it to an offer",
    desc: "Watch the status move from submitted to reviewed, and find your interview schedule waiting here.",
  },
];

/** Facts rather than adjectives — all three are checkable. */
const trust = [
  "One location — CJTECH Shop, Toledo City",
  "Free to apply, always",
  "You only ever see your own applications",
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const browse = () => navigate(user ? "/find-jobs" : "/login");

  return (
    <>
      <section className="hero-section">
        <div className="hero-content-wrapper fade-in">
          <div className="hero-badge">CJTECH Computer Trading</div>

          <h1 className="hero-title">
            Your next role, <span>matched to your skills</span>
          </h1>

          <p className="hero-description">
            CJLink is the application portal for CJTECH Computer Trading, a
            computer and electronics store in Toledo City. Browse open roles,
            apply with your skills and resume, and follow every application
            from submission to offer.
          </p>

          <div className="hero-buttons">
            <button className="hero-btn-primary" onClick={() => navigate("/login")}>
              Create an account →
            </button>
            <button className="hero-btn-secondary" onClick={browse}>
              Browse open jobs
            </button>
          </div>

          <ul className="hero-trust">
            {trust.map((t) => (
              <li key={t}>
                <span className="trust-mark" aria-hidden="true">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The page never answered "how does this actually work?" — for a job
          portal that is the whole question a first-time visitor has. */}
      <section className="how-section">
        <h2 className="section-title">How CJLink Works</h2>
        <p className="section-subtitle">Three steps, from first visit to first day.</p>

        <div className="steps-grid">
          {steps.map((s, i) => (
            <div key={s.n} className="step-card fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="step-num">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="features-section">
        <h2 className="section-title">What You Can Do</h2>
        <p className="section-subtitle">
          Everything you need to apply, and everything the hiring team needs to get back to you.
        </p>

        <div className="features-grid">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="feature-card fade-in"
              style={{ animationDelay: `${i * 0.1}s`, borderLeft: `3px solid ${f.accent}` }}
            >
              <div className="feature-icon" style={{ background: `${f.accent}26` }}>
                {f.icon}
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>Ready to get started?</h2>
        <p>Create your profile once and apply to every open role at CJTECH.</p>
        <div className="cta-actions">
          <button className="hero-btn-primary" onClick={() => navigate("/login")}>
            Create an account →
          </button>
          <button className="hero-btn-secondary" onClick={browse}>
            Browse open jobs
          </button>
        </div>
      </section>
    </>
  );
}
