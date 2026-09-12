import React, { useEffect, useState } from "react";
import api from "../api";

function Shift() {
  const [current, setCurrent] = useState(undefined); // undefined = loading, null = no open shift
  const [history, setHistory] = useState([]);
  const [openingFloat, setOpeningFloat] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closing, setClosing] = useState(false);
  const [lastClosed, setLastClosed] = useState(null);

  const loadCurrent = () => {
    api.get("/shifts/current").then((res) => setCurrent(res.data));
  };

  const loadHistory = () => {
    api.get("/shifts").then((res) => setHistory(res.data));
  };

  useEffect(() => {
    loadCurrent();
    loadHistory();
    const interval = setInterval(loadCurrent, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    await api.post("/shifts/open", { opening_float: parseFloat(openingFloat) || 0 });
    setOpeningFloat("");
    loadCurrent();
    loadHistory();
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!current) return;
    setClosing(true);
    try {
      const res = await api.post(`/shifts/${current.id}/close`, {
        counted_cash: parseFloat(countedCash) || 0,
        notes: closeNotes || null,
      });
      setLastClosed(res.data);
      setCountedCash("");
      setCloseNotes("");
      loadCurrent();
      loadHistory();
    } finally {
      setClosing(false);
    }
  };

  const durationLabel = (openedAt) => {
    const opened = new Date(openedAt);
    const diffMs = Date.now() - opened.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  if (current === undefined) {
    return <div className="shift-page">Loading shift info...</div>;
  }

  return (
    <div className="shift-page">
      <h1>Shift Management</h1>
      <p>Control cash drawer operations and reconcile daily earnings.</p>

      {!current && (
        <div className="shift-card">
          <h3>No Active Shift</h3>
          <p className="shift-hint">Start a shift by counting your opening cash float.</p>
          <form onSubmit={handleOpenShift} className="shift-form">
            <label>Opening Float (₱)</label>
            <input
              type="number"
              placeholder="e.g. 2500"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
            />
            <button type="submit" className="complete-btn">
              Open Shift
            </button>
          </form>
        </div>
      )}

      {current && (
        <>
          <div className="reports-summary">
            <div className="reports-card">
              <div className="reports-label">Current Duration</div>
              <div className="reports-value">{durationLabel(current.opened_at)}</div>
            </div>
            <div className="reports-card">
              <div className="reports-label">Expected Cash in Drawer</div>
              <div className="reports-value">₱{current.expected_cash_in_drawer.toFixed(2)}</div>
            </div>
            <div className="reports-card">
              <div className="reports-label">Transactions</div>
              <div className="reports-value">{current.transaction_count}</div>
            </div>
          </div>

          <div className="shift-columns">
            <div className="shift-card">
              <h3>Terminal Context</h3>
              <div className="shift-detail-row">
                <span>Opening Float</span>
                <span>₱{current.opening_float.toFixed(2)}</span>
              </div>
              <div className="shift-detail-row">
                <span>Cash Sales</span>
                <span>₱{current.cash_sales.toFixed(2)}</span>
              </div>
              <div className="shift-detail-row">
                <span>Total Sales (all methods)</span>
                <span>₱{current.total_sales.toFixed(2)}</span>
              </div>
            </div>

            <div className="shift-card shift-close-card">
              <h3>Close Current Shift</h3>
              <p className="shift-hint">Reconcile cash drawer to end this terminal session.</p>
              <form onSubmit={handleCloseShift} className="shift-form">
                <label>Total Counted Cash (₱)</label>
                <input
                  type="number"
                  placeholder="Count physical cash + float"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                />
                <label>Variance Notes (optional)</label>
                <textarea
                  rows="2"
                  placeholder="Explain any discrepancy..."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                />
                <button type="submit" className="danger-btn" disabled={closing}>
                  {closing ? "Closing..." : "Finalize & Close Shift"}
                </button>
              </form>
            </div>
          </div>

          {lastClosed && (
            <div className={`shift-variance ${lastClosed.variance === 0 ? "ok" : "warn"}`}>
              Shift closed. Expected ₱{lastClosed.expected_cash.toFixed(2)}, counted ₱
              {lastClosed.counted_cash.toFixed(2)} — variance{" "}
              <strong>
                {lastClosed.variance >= 0 ? "+" : ""}
                ₱{lastClosed.variance.toFixed(2)}
              </strong>
              .
            </div>
          )}
        </>
      )}

      <h3 className="shift-history-title">Shift History</h3>
      <table className="reports-table">
        <thead>
          <tr>
            <th>Opened</th>
            <th>Closed</th>
            <th>Opening Float</th>
            <th>Counted Cash</th>
            <th>Variance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {history.map((s) => (
            <tr key={s.id}>
              <td>{new Date(s.opened_at).toLocaleString()}</td>
              <td>{s.closed_at ? new Date(s.closed_at).toLocaleString() : "—"}</td>
              <td>₱{s.opening_float.toFixed(2)}</td>
              <td>{s.counted_cash != null ? `₱${s.counted_cash.toFixed(2)}` : "—"}</td>
              <td>{s.variance != null ? `₱${s.variance.toFixed(2)}` : "—"}</td>
              <td>
                <span className={`status-pill ${s.status === "open" ? "ok" : "low"}`}>
                  {s.status}
                </span>
              </td>
            </tr>
          ))}
          {!history.length && (
            <tr>
              <td colSpan="6" className="empty-state">
                No shifts recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Shift;
