import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const features = [
  {
    icon: "💼",
    title: "Browse Jobs at CJTECH",
    desc: "Explore available positions at CJTECH Computer Trading — from sales to technical roles.",
  },
  {
    icon: "🤖",
    title: "AI-Powered Matching",
    desc: "Get smart job recommendations based on your skills with our AI match scoring system.",
  },
  {
    icon: "📄",
    title: "Apply with Resume",
    desc: "Upload your resume and apply to jobs directly through the platform.",
  },
  {
    icon: "🔔",
    title: "Real-Time Updates",
    desc: "Stay notified about application status and interview schedules instantly.",
  },
  {
    icon: "👥",
    title: "Admin Dashboard",
    desc: "Employers can review applicants, manage interviews, and find the best talent.",
  },
  {
    icon: "🛡️",
    title: "Secure & Private",
    desc: "Your data is protected with industry-standard security and encryption.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <>
      <section className="hero-section">
        <div className="hero-content-wrapper fade-in">
          <div className="hero-badge">CJTECH Computer Trading</div>

          <h1 className="hero-title">
            Your Local <span>Job Hub</span>
          </h1>

          <p className="hero-description">
            Apply for jobs at CJTECH Computer Trading. Lokal connects you with
            opportunities at one of Toledo City's leading computer and electronics stores.
          </p>

          <div className="hero-buttons">
            <button className="hero-btn-primary" onClick={() => navigate("/roles")}>
              Get Started Now →
            </button>
            <button className="hero-btn-secondary" onClick={() => navigate(user ? "/find-jobs" : "/roles")}>
              Browse Jobs
            </button>
          </div>
        </div>
      </section>

      <section className="features-section">
        <h2 className="section-title">What You Can Do</h2>
        <p className="section-subtitle">
          Everything you need to apply and get hired at CJTECH Computer Trading.
        </p>

        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "60px" }}>
          <button className="hero-btn-primary" onClick={() => navigate("/roles")}>
            Join Lokal Today →
          </button>
        </div>
      </section>
    </>
  );
}
