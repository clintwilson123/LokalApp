import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const location = useLocation();
  const { user, profile, signOut } = useAuth();

  const links = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About" },
  ];

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        Lok<span>al</span>
      </Link>

      <div className="navbar-links">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`navbar-link ${location.pathname === link.to ? "active" : ""}`}
          >
            {link.label}
          </Link>
        ))}

        {user ? (
          <>
            <Link
              to={profile?.role === "admin" ? "/admin" : "/find-jobs"}
              className="navbar-link dashboard-link"
            >
              📊 Dashboard
            </Link>
            <span className="navbar-user">
              {profile?.full_name || user.email?.split("@")[0]}
            </span>
            <button className="navbar-link logout-link" onClick={signOut}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="navbar-link">Login</Link>
            <Link to="/roles" className="navbar-cta">Get Started →</Link>
          </>
        )}
      </div>
    </nav>
  );
}
