import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <h3>Lok<span>al</span></h3>
          <p>
            Connecting local talent with local employers. 
            Making hiring simple, transparent, and community-driven.
          </p>
        </div>

        <div className="footer-links">
          <Link to="/about">About</Link>
          <Link to="/find-jobs">Find Jobs</Link>
          <Link to="/roles">Get Started</Link>
        </div>

        <div className="footer-social">
          <span>📧 support@lokal.app</span>
          <span>📍 Toledo City, Cebu</span>
        </div>
      </div>

      <div className="footer-bottom">
        &copy; {new Date().getFullYear()} Lokal. All rights reserved. — Built with ❤️ for CJTECH Computer Trading
      </div>
    </footer>
  );
}
