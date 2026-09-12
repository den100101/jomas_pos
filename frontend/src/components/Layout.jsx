import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import SalesTicker from "./SalesTicker";

function Layout({ user, onLogout, children }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate("/");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🔥</span>
          JoMa's Arroz Frito Point of Sale
        </div>

        <nav className="topnav">
          <NavLink to="/pos" className="nav-link">
            POS
          </NavLink>
          <NavLink to="/kitchen" className="nav-link">
            Kitchen
          </NavLink>
          <NavLink to="/inventory" className="nav-link">
            Inventory
          </NavLink>
          <NavLink to="/reports" className="nav-link">
            Reports
          </NavLink>
          <NavLink to="/shift" className="nav-link">
            Shift
          </NavLink>
          <NavLink to="/settings" className="nav-link">
            Settings
          </NavLink>
        </nav>

        <SalesTicker />

        <div className="user-box">
          <div className="user-info">
            <div className="user-terminal">Terminal #01</div>
            <div className="user-name">{user.name}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Log out">
            ⎋
          </button>
        </div>
      </header>

      <main className="app-content">{children}</main>
    </div>
  );
}

export default Layout;
