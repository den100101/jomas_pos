import React, { useEffect, useState } from "react";
import api from "../api";

function SalesTicker() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = () => {
      api
        .get("/sales/live")
        .then((res) => setStats(res.data))
        .catch(() => {});
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div className="sales-ticker">
      <div className="ticker-item">
        <span className="ticker-dot" />
        Today: <strong>₱{stats.revenue_today.toFixed(2)}</strong>
      </div>
      <div className="ticker-item">{stats.orders_today} orders</div>
      <div className="ticker-item">{stats.pending_in_kitchen} in kitchen</div>
    </div>
  );
}

export default SalesTicker;
