import React, { useEffect, useState } from "react";
import api from "../api";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];

function Reports() {
  const [range, setRange] = useState("today");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get(`/reports/summary?range=${range}`).then((res) => setSummary(res.data));
  }, [range]);

  if (!summary) {
    return <div className="reports-page">Loading analytics...</div>;
  }

  const maxItemRevenue = Math.max(1, ...summary.top_items.map((i) => i.revenue));
  const paymentEntries = Object.entries(summary.payment_split);
  const maxPayment = Math.max(1, ...paymentEntries.map(([, v]) => v));

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1>Sales Analytics</h1>
          <p>Monitoring restaurant performance and revenue growth.</p>
        </div>
        <div className="range-tabs">
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={`range-tab ${range === r.key ? "active" : ""}`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="reports-summary">
        <div className="reports-card">
          <div className="reports-label">Total Revenue</div>
          <div className="reports-value">₱{summary.total_revenue.toFixed(2)}</div>
        </div>
        <div className="reports-card">
          <div className="reports-label">Total Transactions</div>
          <div className="reports-value">{summary.total_transactions}</div>
        </div>
        <div className="reports-card">
          <div className="reports-label">Average Ticket</div>
          <div className="reports-value">₱{summary.average_ticket.toFixed(2)}</div>
        </div>
      </div>

      <div className="reports-columns">
        <div className="reports-block">
          <h3>Top Selling Items</h3>
          {summary.top_items.map((item) => (
            <div key={item.name} className="bar-row">
              <div className="bar-label">
                <span>{item.name}</span>
                <span>₱{item.revenue.toFixed(2)}</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${(item.revenue / maxItemRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {!summary.top_items.length && <div className="empty-state">No sales in this range.</div>}
        </div>

        <div className="reports-block">
          <h3>Sales by Payment Method</h3>
          {paymentEntries.map(([method, value]) => (
            <div key={method} className="bar-row">
              <div className="bar-label">
                <span>{method.toUpperCase()}</span>
                <span>₱{value.toFixed(2)}</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill payment"
                  style={{ width: `${(value / maxPayment) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {!paymentEntries.length && <div className="empty-state">No sales in this range.</div>}
        </div>
      </div>
    </div>
  );
}

export default Reports;
