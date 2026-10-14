import { useNavigate } from "react-router-dom";
import { colors } from "../uiStyles";
import clint from "../images/ClintWilsonGonzales.jpeg.jpg";
import jay from "../images/JayMicaRebias.jpeg.jpg";
import rechelle from "../images/RechelleCabahug.jpeg.jpg";
import carey from "../images/CareyAcaylar.jpeg.jpg";
import arnel from "../images/ArnelVillanueva.jpeg.jpeg";

const highlights = [
  { icon: "🎯", title: "Our Mission", desc: "Connect local talents with nearby employers to strengthen community economies and make hiring simple, transparent, and accessible." },
  { icon: "👁️", title: "Our Vision", desc: "A world where every local community has the tools to match skilled workers with the right opportunities — no matter the location." },
  { icon: "🤝", title: "For Job Seekers", desc: "Browse jobs, upload your resume, see a match score on every role, apply in one click, and follow your application through to the interview." },
  { icon: "🏪", title: "For Employers", desc: "Post jobs, review applicants side by side with their match scores, schedule interviews, and find the best local talent — all from one dashboard." },
];

/**
 * Real figures, all four of them checkable.
 *
 * Three of these used to be emoji rendered at 28px under the heading
 * "stats" — 🤖, ⚡ and 🔒 next to a single genuine "100%". A row of
 * decorations standing in for numbers is the least professional thing on
 * either of these pages.
 */
const stats = [
  { number: "100%", label: "Local Focus" },
  { number: "5", label: "Team Members" },
  { number: "1", label: "Shop Location" },
  { number: "0", label: "Fees to Apply" },
];

const categories = [
  { label: "Frontend", items: ["React 19", "Vite 7", "React Router"] },
  { label: "Backend", items: ["Supabase", "Deno", "Edge Functions"] },
  { label: "Database", items: ["PostgreSQL 17"] },
  { label: "AI / ML", items: ["Gemini API", "Skill Matching"] },
  { label: "Deployment", items: ["Vercel", "Supabase Cloud"] },
  { label: "Testing", items: ["Vitest", "Testing Library"] },
  { label: "Linting", items: ["ESLint 9"] },
];

const team = [
  { img: clint, name: "Clint Wilson Gonzales", role: "Lead Developer" },
  { img: jay, name: "Jay Mica Rebias", role: "Assistant Developer" },
  { img: rechelle, name: "Rechelle Cabahug", role: "UI/UX Designer" },
  { img: carey, name: "Carey Acaylar", role: "UI/UX Designer" },
  { img: arnel, name: "Arnel Villanueva", role: "QA Tester" },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div style={fullPageStyle}>
      <div style={pageStyle}>
        {/* Hero */}
        <section style={heroSection}>
          <div style={heroBg} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={eyebrow}>CJTECH COMPUTER TRADING · TOLEDO CITY</div>
            <h1 style={heroTitle}>
              About <span style={{ color: "#93c5fd" }}>CJLink</span>
            </h1>
            <p style={heroDesc}>
              CJLink connects local talent with local opportunities at CJTECH
              Computer Trading — one place to find an open role, apply to it,
              and follow your application through to an offer.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "28px", flexWrap: "wrap" }}>
              <span style={heroStat}>Local jobs</span>
              <span style={heroStat}>Skill matching</span>
              <span style={heroStat}>Application tracking</span>
            </div>
          </div>
        </section>

        {/* Stats row */}
        <section style={statsRow}>
          {stats.map((s) => (
            <div key={s.label} style={statCard}>
              <div style={statNumber}>{s.number}</div>
              <div style={statLabel}>{s.label}</div>
            </div>
          ))}
        </section>

        {/* Mission & Values */}
        <section style={sectionPadding}>
          <div style={sectionLabel}>WHAT WE STAND FOR</div>
          <h2 style={sectionTitle}>Our Purpose</h2>
          <div style={grid2x2}>
            {highlights.map((h) => (
              <div key={h.title} className="about-card" style={highlightCard}>
                <div style={iconCircle}>{h.icon}</div>
                <h3 style={highlightTitle}>{h.title}</h3>
                <p style={highlightDesc}>{h.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Meet the Team */}
        <section style={sectionPadding}>
          <div style={sectionLabel}>OUR TEAM</div>
          <h2 style={sectionTitle}>Meet the Developers</h2>
          <p style={sectionSub}>The people behind CJLink</p>
          <div style={teamGrid}>
            {team.map((m) => (
              <div key={m.name} className="about-card" style={teamCard}>
                <div style={teamImgWrapper}>
                  <img src={m.img} alt={m.name} style={teamImg} />
                </div>
                <h3 style={teamName}>{m.name}</h3>
                <p style={teamRole}>{m.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech Stack */}
        <section style={techSection}>
          <div style={sectionLabel}>TECH STACK</div>
          <h2 style={sectionTitle}>Built With Modern Tech</h2>
          <p style={sectionSub}>The tools and services that power the platform</p>
          <div style={techGrid}>
            {categories.map((cat) => (
              <div key={cat.label} style={catCard}>
                <div style={catLabel}>{cat.label}</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {cat.items.map((t) => (
                    <span key={t} style={techBadge}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA — same band the home page closes on */}
        <section className="cta-band">
          <h2>Ready to get started?</h2>
          <p>Join CJLink today and take the next step in your career, or find your next top performer.</p>
          <div className="cta-actions">
            <button style={btnPrimary} onClick={() => navigate("/signup")}>Get Started →</button>
            <button style={btnSecondary} onClick={() => navigate("/")}>Back to Home</button>
          </div>
        </section>
      </div>
    </div>
  );
}

const fullPageStyle = {
  background: "linear-gradient(135deg, #0f172a 0%, #1a3b5c 50%, #1e4d7a 100%)",
  minHeight: "100vh",
};

// 720px squeezed every section. The tech stack was further pinned to a 500px
// column inside it, so seven categories of badges stacked one under the other
// in a strip a phone could have used.
const pageStyle = {
  fontFamily: "'Inter', sans-serif",
  maxWidth: "1040px",
  margin: "0 auto",
  padding: "0 24px 40px",
  color: "#fff",
};

const heroSection = {
  textAlign: "center",
  padding: "70px 20px 60px",
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
const eyebrow = {
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "2.5px",
  color: "#bfdbfe",
  marginBottom: "14px",
};
const heroTitle = { fontSize: "44px", fontWeight: "800", color: "#fff", margin: "0 0 14px" };
const heroDesc = {
  fontSize: "16px", color: "rgba(255,255,255,0.85)", lineHeight: "1.75",
  maxWidth: "600px", margin: "0 auto",
};
const heroStat = {
  fontSize: "12px", fontWeight: "600", padding: "6px 14px",
  borderRadius: "20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
};

const statsRow = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px", margin: "-30px auto 50px",
  position: "relative", zIndex: 2, maxWidth: "760px",
};
const statCard = {
  backgroundColor: "rgba(255,255,255,0.07)", padding: "20px 12px", borderRadius: "16px",
  textAlign: "center", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)",
};
const statNumber = { fontSize: "30px", fontWeight: "800", color: "#fff", lineHeight: "1.1", marginBottom: "5px" };
const statLabel = { fontSize: "12px", color: "rgba(255,255,255,0.55)", fontWeight: "600" };

const sectionPadding = { marginBottom: "56px" };
// #1a73e8 on #0f172a is about 3.5:1 — under AA for 11px bold text. This is
// an eyebrow label, so it has to be readable, not merely present.
const sectionLabel = {
  fontSize: "11px", fontWeight: "700", color: "#93c5fd",
  letterSpacing: "2px", marginBottom: "6px", textAlign: "center",
};
const sectionTitle = { fontSize: "26px", fontWeight: "800", color: "#fff", margin: "0 0 20px", textAlign: "center" };
const sectionSub = { fontSize: "14px", color: "rgba(255,255,255,0.55)", margin: "-14px 0 26px", textAlign: "center" };

const grid2x2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" };
const highlightCard = {
  backgroundColor: "rgba(255,255,255,0.06)", padding: "26px 24px", borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.1)", textAlign: "left",
  backdropFilter: "blur(12px)",
};
const iconCircle = {
  width: "46px", height: "46px", borderRadius: "13px",
  backgroundColor: "rgba(74,144,226,0.2)", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "21px", marginBottom: "14px",
};
const highlightTitle = { color: "#fff", fontSize: "16px", fontWeight: "800", margin: "0 0 8px" };
const highlightDesc = { color: "rgba(255,255,255,0.7)", fontSize: "13px", lineHeight: "1.7", margin: 0 };

const teamGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "20px",
  marginTop: "10px",
};
const teamCard = {
  backgroundColor: "rgba(255,255,255,0.06)",
  padding: "26px 16px",
  borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.1)",
  textAlign: "center",
  backdropFilter: "blur(12px)",
};
const teamImgWrapper = {
  width: "96px",
  height: "96px",
  borderRadius: "50%",
  overflow: "hidden",
  margin: "0 auto 14px",
  border: `3px solid ${colors.primaryLight}`,
};
const teamImg = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};
const teamName = {
  color: "#fff",
  fontSize: "14px",
  fontWeight: "800",
  margin: "0 0 4px",
};
const teamRole = {
  color: "#93c5fd",
  fontSize: "12px",
  fontWeight: "600",
  margin: 0,
};

const techSection = {
  marginBottom: "56px",
  backgroundColor: "rgba(255,255,255,0.04)",
  borderRadius: "24px",
  padding: "44px 34px",
  border: "1px solid rgba(255,255,255,0.08)",
};
const techGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
};
const catCard = {
  padding: "16px 18px",
  backgroundColor: "rgba(255,255,255,0.05)",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.1)",
};
const catLabel = {
  fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.6)",
  textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "10px",
};
const techBadge = {
  fontSize: "13px", padding: "6px 14px", borderRadius: "8px",
  backgroundColor: "rgba(74,144,226,0.2)", color: "#93c5fd", fontWeight: "600",
};

const btnPrimary = {
  padding: "12px 28px", background: "linear-gradient(135deg, #4a90e2, #1a73e8)", color: "#fff", border: "none",
  borderRadius: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 16px rgba(26,115,232,0.3)",
};
const btnSecondary = {
  padding: "12px 28px", backgroundColor: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer",
};
