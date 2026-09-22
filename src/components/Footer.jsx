import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <h3>CJ<span>Link</span></h3>
          <p>
            Connecting local talent with local employers. 
            Making hiring simple, transparent, and community-driven.
          </p>
        </div>

        <div className="footer-links">
          <Link to="/about">About</Link>
          <Link to="/signup">Get Started</Link>
          <Link to="/login">Sign In</Link>
        </div>

        <div className="footer-social">
          <span>📧 support@cjlink.app</span>
          <span>📍 Toledo City, Cebu</span>
        </div>
      </div>

      <div className="footer-bottom">
        &copy; {new Date().getFullYear()} CJLink. All rights reserved. — Built with ❤️ for CJTECH Computer Trading
      </div>
    </footer>
  );
}
