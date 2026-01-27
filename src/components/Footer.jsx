export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.card}>
        <div style={styles.left}>
          <h3 style={styles.logo}>Lokal</h3>
          <p style={styles.text}>
            Lokal connects local companies with local talent, making job
            discovery and hiring simple and community-focused.
          </p>
        </div>

        <div style={styles.right}>
          <span style={styles.link}>About</span>
          <span style={styles.link}>Find Jobs</span>
          <span style={styles.link}>Discover Talent</span>
          <span style={styles.link}>Contact</span>
        </div>
      </div>

      <p style={styles.copy}>
        © {new Date().getFullYear()} Lokal. All rights reserved.
      </p>
    </footer>
  );
}

const styles = {
  footer: {
    background: "#f4f7fb",
    padding: "30px 20px",
    marginTop: "60px"
  },
  card: {
    maxWidth: "1100px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "16px",
    padding: "25px 30px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
    flexWrap: "wrap",
    gap: "20px"
  },
  left: {
    maxWidth: "420px"
  },
  logo: {
    color: "#1d4ed8",
    marginBottom: "8px"
  },
  text: {
    fontSize: "14px",
    color: "#555"
  },
  right: {
    display: "flex",
    gap: "20px",
    fontSize: "14px",
    fontWeight: "500"
  },
  link: {
    color: "#1d4ed8",
    cursor: "pointer"
  },
  copy: {
    textAlign: "center",
    marginTop: "20px",
    fontSize: "13px",
    color: "#777"
  }
};
