import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import SalesTicker from "./SalesTicker";
import LowStockBell from "./LowStockBell";
import { PAGE_PATHS, canAccess } from "../utils/auth";

// Every menu link; each user only sees the ones their role can open.
const NAV_ITEMS = [
  { page: "pos", label: "POS" },
  { page: "kitchen", label: "Kitchen" },
  { page: "inventory", label: "Inventory" },
  { page: "reports", label: "Reports" },
  { page: "shift", label: "Shift" },
  { page: "settings", label: "Settings" },
];

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
          {NAV_ITEMS.filter((item) => canAccess(user.role, item.page)).map(
            (item) => (
              <NavLink
                key={item.page}
                to={PAGE_PATHS[item.page]}
                className="nav-link"
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        {/* The sales ticker shows revenue, so kitchen staff don't get it */}
        {canAccess(user.role, "pos") && <SalesTicker />}

        {/* Low-stock bell: only appears for admins */}
        <LowStockBell />

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
