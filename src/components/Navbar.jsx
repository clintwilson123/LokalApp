import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={styles.nav}>
      <h2 style={styles.logo}>Lokal</h2>
      <div style={styles.links}>
        <Link to="/" style={styles.link}>Home</Link>
        <Link to="/find-jobs" style={styles.link}>Jobs</Link>
        <Link to="/discover-talent" style={styles.link}>Talent</Link>
        <Link to="/notifications" style={styles.link}>Notifications</Link>
        <Link to="/interview-schedule" style={styles.link}>Schedule</Link>
        <Link to="/about" style={styles.link}>About</Link>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    background: "#0f172a",
    padding: "15px 40px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  logo: { color: "#fff" },
  links: { display: "flex", gap: "20px" },
  link: { color: "#cbd5e1", textDecoration: "none" }
};
