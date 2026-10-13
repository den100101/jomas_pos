import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { getUser, PAGE_PATHS } from "../utils/auth";
import "../styles/analytics.css";

const REFRESH_MS = 30000; // check for low stock every 30 seconds

const tidy = (value) => Math.round(Number(value) * 100) / 100;

// Bell icon with a red count of ingredients at or below their reorder level.
// Only admins see it (the backend only lets admins read inventory anyway).
export default function LowStockBell() {
  const isAdmin = getUser()?.role === "admin";
  const [data, setData] = useState({ count: 0, items: [] });
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    const load = () =>
      api
        .get("/ingredients/low-stock")
        .then((res) => active && setData(res.data))
        .catch(() => {});
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isAdmin]);

  // Close the dropdown when clicking anywhere else.
  useEffect(() => {
    const onClick = (event) => {
      if (box.current && !box.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!isAdmin) return null;

  return (
    <div className="bell-wrap" ref={box}>
      <button
        type="button"
        className="bell-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Low stock alerts: ${data.count}`}
      >
        🔔
        {data.count > 0 && <span className="bell-badge">{data.count}</span>}
      </button>

      {open && (
        <div className="bell-menu">
          <div className="bell-title">Low stock</div>
          {data.items.length === 0 ? (
            <p className="bell-empty">
              Every ingredient is above its reorder level.
            </p>
          ) : (
            <ul>
              {data.items.map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <span
                    className={
                      item.stock_quantity <= 0 ? "bell-out" : "bell-low"
                    }
                  >
                    {item.stock_quantity <= 0
                      ? "Out of stock"
                      : `${tidy(item.stock_quantity)} ${item.unit} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to={PAGE_PATHS.inventory}
            className="bell-link"
            onClick={() => setOpen(false)}
          >
            Open inventory
          </Link>
        </div>
      )}
    </div>
  );
}
