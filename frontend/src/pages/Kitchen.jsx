import React, { useEffect, useState } from "react";
import api from "../api";

const COLUMNS = [
  { status: "pending", label: "Pending" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "completed", label: "Completed" },
];

const NEXT_STATUS = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};

function Kitchen() {
  const [orders, setOrders] = useState([]);

  const loadOrders = () => {
    api.get("/orders?status=pending,preparing,ready,completed&limit=40").then((res) =>
      setOrders(res.data)
    );
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 8000); // real-time-ish refresh
    return () => clearInterval(interval);
  }, []);

  const advanceStatus = async (order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    await api.patch(`/orders/${order.id}/status`, { status: next });
    loadOrders();
  };

  return (
    <div className="kitchen-page">
      <h1>Kitchen &amp; Operations</h1>
      <p className="kitchen-sub">Track and advance orders through prep, ready, and served.</p>

      <div className="kitchen-board">
        {COLUMNS.map((col) => {
          const columnOrders = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className="kitchen-column">
              <div className="kitchen-column-header">
                {col.label} <span className="kitchen-count">{columnOrders.length}</span>
              </div>

              <div className="kitchen-cards">
                {columnOrders.map((order) => (
                  <div key={order.id} className="kitchen-card">
                    <div className="kitchen-card-top">
                      <span>#{order.order_number}</span>
                      <span className="kitchen-time">
                        {new Date(order.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <ul className="kitchen-items">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          {item.quantity}× {item.product_name}
                          {item.modifiers && <div className="kitchen-mod">{item.modifiers}</div>}
                          {item.notes && <div className="kitchen-note">Note: {item.notes}</div>}
                        </li>
                      ))}
                    </ul>

                    {NEXT_STATUS[order.status] && (
                      <button className="kitchen-advance-btn" onClick={() => advanceStatus(order)}>
                        Mark as {NEXT_STATUS[order.status]}
                      </button>
                    )}
                  </div>
                ))}
                {!columnOrders.length && <div className="empty-state">No orders here.</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Kitchen;
