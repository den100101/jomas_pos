import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import SalesTicker from "./SalesTicker";
import LowStockBell from "./LowStockBell";
import { PAGE_PATHS, canAccess } from "../utils/auth";
import "../styles/analytics.css";

// Every menu link; each user only sees the ones their role can open.
const NAV_ITEMS = [
  { page: "pos", label: "POS" },
  { page: "orders", label: "Orders" },
  { page: "kitchen", label: "Kitchen" },
  { page: "inventory", label: "Inventory" },
  { page: "reports", label: "Dashboard" },
  { page: "shift", label: "Shift" },
  { page: "settings", label: "Settings" },
];

// Live clock in Philippine time so staff can always see the time.
// (It reads the computer/tablet's own clock - if that is wrong, fix it in the device settings.)
function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="clock">
      <div className="clock-time">{time}</div>
      <div className="clock-date">{date}</div>
    </div>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

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
          {NAV_ITEMS.filter((item) => canAccess(user.role, item.page)).map((item) => (
            <NavLink key={item.page} to={PAGE_PATHS[item.page]} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* The sales ticker shows revenue, so kitchen staff don't get it */}
        {canAccess(user.role, "pos") && <SalesTicker />}

        {/* Low-stock bell: only appears for admins */}
        <LowStockBell />

        <Clock />

        <div className="user-box">
          <div className="user-info">
            <div className="user-terminal">Terminal #01</div>
            <div className="user-name">{user.name}</div>
          </div>
          <button className="logout-btn" onClick={toggleFullscreen} title="Full screen">
            ⛶
          </button>
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
