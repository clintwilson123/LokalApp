import { useNavigate } from "react-router-dom";
import { colors } from "../uiStyles";

const highlights = [
  { icon: "🎯", title: "Our Mission", desc: "Connect local talents with nearby employers to strengthen community economies and make hiring simple, transparent, and accessible." },
  { icon: "👁️", title: "Our Vision", desc: "A world where every local community has the tools to match skilled workers with the right opportunities — no matter the location." },
  { icon: "🤝", title: "For Job Seekers", desc: "Browse jobs, upload your resume, get AI-matched recommendations, apply in one click, and receive real-time notifications on your application status." },
  { icon: "🏪", title: "For Employers", desc: "Post jobs, review AI-scored applicant matches, manage interviews, and find the best local talent — all from one dashboard." },
];

const stats = [
  { number: "100%", label: "Local Focus" },
  { number: "🤖", label: "AI-Powered" },
  { number: "⚡", label: "Real-Time" },
  { number: "🔒", label: "Secure" },
];

const categories = [
  { label: "Frontend", items: ["React", "Vite"] },
  { label: "Backend", items: ["Supabase", "Deno", "Edge Functions"] },
  { label: "Database", items: ["PostgreSQL"] },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div style={pageStyle}>
      {/* Hero */}
      <section style={heroSection}>
        <div style={heroBg} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={badge}>🚀 Capstone Project</div>
          <h1 style={heroTitle}>
            About <span style={{ color: "#fff" }}>Lokal</span>
          </h1>
          <p style={heroDesc}>
            A modern job portal powered by AI — connecting local talent
            with local opportunities at CJTECH Computer Trading.
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "28px" }}>
            <span style={heroStat}>🎯 Local Jobs</span>
            <span style={heroStat}>🤖 AI Matching</span>
            <span style={heroStat}>📱 Real-Time</span>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section style={statsRow}>
        {stats.map((s, i) => (
          <div key={i} style={statCard}>
            <div style={{ fontSize: "28px", marginBottom: "4px" }}>{s.number}</div>
            <div style={{ fontSize: "12px", color: colors.textSecondary, fontWeight: "600" }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Mission & Values */}
      <section style={sectionPadding}>
        <div style={sectionLabel}>WHAT WE STAND FOR</div>
        <h2 style={sectionTitle}>Our Purpose</h2>
        <div style={grid2x2}>
          {highlights.map((h, i) => (
            <div key={i} style={highlightCard}>
              <div style={iconCircle}>{h.icon}</div>
              <h3 style={{ color: colors.navy, fontSize: "16px", fontWeight: "800", margin: "0 0 8px" }}>{h.title}</h3>
              <p style={{ color: colors.textSecondary, fontSize: "13px", lineHeight: "1.7", margin: 0 }}>{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section style={{ ...sectionPadding, backgroundColor: "#f8fafc", borderRadius: "24px", padding: "40px 32px" }}>
        <div style={sectionLabel}>TECH STACK</div>
        <h2 style={sectionTitle}>Built With Modern Tech</h2>
        <p style={sectionSub}>The tools and services that power the platform</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "500px", margin: "0 auto" }}>
          {categories.map((cat) => (
            <div key={cat.label} style={catRow}>
              <span style={catLabel}>{cat.label}</span>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {cat.items.map((t) => (
                  <span key={t} style={techBadge}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ textAlign: "center", padding: "50px 20px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "800", color: colors.navy, margin: "0 0 10px" }}>
          Ready to Get Started?
        </h2>
        <p style={{ color: colors.textSecondary, fontSize: "14px", margin: "0 0 28px", maxWidth: "400px", marginLeft: "auto", marginRight: "auto" }}>
          Join Lokal today and take the next step in your career or find your next top performer.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button style={btnPrimary} onClick={() => navigate("/roles")}>Get Started →</button>
          <button style={btnSecondary} onClick={() => navigate("/")}>Back to Home</button>
        </div>
      </section>
    </div>
  );
}

const pageStyle = {
  fontFamily: "'Inter', sans-serif",
  maxWidth: "720px",
  margin: "0 auto",
  padding: "0 24px 60px",
};

const heroSection = {
  textAlign: "center",
  padding: "60px 20px 50px",
  position: "relative",
  overflow: "hidden",
};
const heroBg = {
  position: "absolute",
  inset: 0,
  background: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.navy})`,
  borderRadius: "32px",
  opacity: 0.9,
};
const badge = {
  display: "inline-block", fontSize: "12px", fontWeight: "700", color: colors.navy,
  backgroundColor: "rgba(255,255,255,0.95)", padding: "6px 14px", borderRadius: "20px", marginBottom: "16px",
};
const heroTitle = { fontSize: "38px", fontWeight: "800", color: "#fff", margin: "0 0 12px" };
const heroDesc = {
  fontSize: "15px", color: "rgba(255,255,255,0.85)", lineHeight: "1.7",
  maxWidth: "480px", margin: "0 auto",
};
const heroStat = {
  fontSize: "12px", fontWeight: "600", padding: "6px 14px",
  borderRadius: "20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
};

const statsRow = {
  display: "flex", gap: "12px", margin: "-30px auto 40px",
  position: "relative", zIndex: 2, maxWidth: "500px",
};
const statCard = {
  flex: 1, backgroundColor: "#fff", padding: "16px 10px", borderRadius: "16px",
  textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
};

const sectionPadding = { marginBottom: "50px" };
const sectionLabel = {
  fontSize: "11px", fontWeight: "700", color: colors.primaryDark,
  letterSpacing: "2px", marginBottom: "6px", textAlign: "center",
};
const sectionTitle = { fontSize: "24px", fontWeight: "800", color: colors.navy, margin: "0 0 20px", textAlign: "center" };
const sectionSub = { fontSize: "14px", color: colors.textSecondary, margin: "-12px 0 24px", textAlign: "center" };

const grid2x2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" };
const highlightCard = {
  backgroundColor: "#fff", padding: "24px 20px", borderRadius: "20px",
  border: "1px solid #eef2f6", textAlign: "center",
  transition: "transform 0.2s, box-shadow 0.2s",
};
const iconCircle = {
  width: "48px", height: "48px", borderRadius: "50%",
  backgroundColor: "#d6e6f7", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "22px", margin: "0 auto 14px",
};

const catRow = {
  display: "flex", alignItems: "center", gap: "16px",
  padding: "12px 16px", backgroundColor: "#fff", borderRadius: "12px",
  border: "1px solid #eef2f6",
};
const catLabel = {
  fontSize: "12px", fontWeight: "700", color: colors.textSecondary,
  minWidth: "80px", textTransform: "uppercase", letterSpacing: "1px",
};
const techBadge = {
  fontSize: "13px", padding: "6px 14px", borderRadius: "8px",
  backgroundColor: "#d6e6f7", color: colors.primaryDark, fontWeight: "600",
};

const btnPrimary = {
  padding: "12px 28px", backgroundColor: colors.primaryDark, color: "#fff", border: "none",
  borderRadius: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer",
};
const btnSecondary = {
  padding: "12px 28px", backgroundColor: "#fff", color: colors.navy, border: "1px solid #e2eaf4",
  borderRadius: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer",
};
