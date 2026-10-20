import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { getUser } from "../utils/auth";
import "../styles/analytics.css";

const REASONS = [
  "Wrong item punched",
  "Wrong quantity",
  "Customer changed mind",
  "Duplicate order",
  "Other",
];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "In kitchen" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const IN_KITCHEN = ["pending", "preparing", "ready"];

const peso = (value) =>
  "₱" + Number(value).toLocaleString("en-PH", { maximumFractionDigits: 2 });

const formatTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

export default function Orders() {
  const isAdmin = getUser()?.role === "admin";

  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loadError, setLoadError] = useState("");

  // The order being cancelled (null = dialog closed)
  const [target, setTarget] = useState(null);
  const [choice, setChoice] = useState(REASONS[0]);
  const [other, setOther] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get("/orders", { params: { limit: 100 } })
      .then((res) => {
        setOrders(res.data);
        setLoadError("");
      })
      .catch(() => setLoadError("Could not load orders."));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000); // keep the list fresh
    return () => clearInterval(timer);
  }, [load]);

  // Cashiers can cancel while the order is still in the kitchen queue;
  // only an admin can cancel one that is already completed.
  const canCancel = (order) =>
    order.status !== "cancelled" && (isAdmin || order.status !== "completed");

  const openCancel = (order) => {
    setTarget(order);
    setChoice(REASONS[0]);
    setOther("");
    setCancelError("");
  };

  const confirmCancel = async () => {
    const reason = choice === "Other" ? other.trim() : choice;
    if (!reason) {
      setCancelError("Please type the reason.");
      return;
    }
    setBusy(true);
    setCancelError("");
    try {
      await api.post(`/orders/${target.id}/cancel`, { reason });
      setTarget(null);
      load();
    } catch (err) {
      setCancelError(err.response?.data?.error || "Could not cancel the order.");
    } finally {
      setBusy(false);
    }
  };

  const visible = orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "active") return IN_KITCHEN.includes(order.status);
    return order.status === filter;
  });

  return (
    <div className="orders-page">
      <h2>Orders</h2>
      <p className="orders-hint">
        Punched the wrong order? Cancel it here. The ingredients go back to stock and the
        order is left out of sales.
      </p>

      <div className="preset-buttons orders-filters">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`report-btn ${filter === item.key ? "active" : ""}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loadError && <p className="report-error">{loadError}</p>}

      <div className="report-panel">
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Time</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan="6" className="chart-empty">No orders to show.</td>
                </tr>
              )}
              {visible.map((order) => (
                <tr key={order.id} className={order.status === "cancelled" ? "order-cancelled" : ""}>
                  <td>{order.order_number}</td>
                  <td>{formatTime(order.created_at)}</td>
                  <td className="orders-items">
                    {order.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
                    {order.status === "cancelled" && (
                      <div className="orders-why">
                        Cancelled by {order.cancelled_by || "staff"} ({formatTime(order.cancelled_at)}):{" "}
                        {order.cancel_reason}
                      </div>
                    )}
                  </td>
                  <td>{peso(order.total)}</td>
                  <td>
                    <span className={`status-badge status-${order.status}`}>{order.status}</span>
                  </td>
                  <td>
                    {canCancel(order) && (
                      <button type="button" className="cancel-btn" onClick={() => openCancel(order)}>
                        Cancel order
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {target && (
        <div className="cancel-overlay" onClick={() => !busy && setTarget(null)}>
          <div className="cancel-box" onClick={(e) => e.stopPropagation()}>
            <h3>Cancel order {target.order_number}?</h3>
            <p className="orders-hint">
              {target.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")} -{" "}
              {peso(target.total)}
            </p>

            <label className="report-field">
              Reason
              <select value={choice} onChange={(e) => setChoice(e.target.value)}>
                {REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </label>

            {choice === "Other" && (
              <label className="report-field">
                Type the reason
                <input
                  type="text"
                  value={other}
                  maxLength={200}
                  onChange={(e) => setOther(e.target.value)}
                />
              </label>
            )}

            {cancelError && <p className="report-error">{cancelError}</p>}

            <div className="cancel-actions">
              <button type="button" className="report-btn" disabled={busy} onClick={() => setTarget(null)}>
                Keep order
              </button>
              <button type="button" className="cancel-btn solid" disabled={busy} onClick={confirmCancel}>
                {busy ? "Cancelling..." : "Yes, cancel it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
