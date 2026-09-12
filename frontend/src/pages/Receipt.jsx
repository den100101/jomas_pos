import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";

function Receipt() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/orders/${orderId}`).then((res) => setOrder(res.data));
    api.get("/settings").then((res) => setSettings(res.data));
  }, [orderId]);

  if (!order || !settings) {
    return <div className="receipt-page">Loading receipt...</div>;
  }

  const date = new Date(order.created_at);

  const handlePrint = () => window.print();

  const handleEmailReceipt = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setSentMessage("");

    try {
      const res = await api.post(`/orders/${orderId}/email-receipt`, { email });
      setSentMessage(res.data.message);
    } catch (err) {
      setSentMessage("Could not send receipt. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="receipt-page">
      <div className="receipt-card">
        <div className="receipt-check">✔</div>
        <h2>Order Finalized</h2>
        <p className="receipt-sub">
          The transaction for Order #{order.order_number} has been processed successfully.
        </p>

        <div className="receipt-ticket">
          <h3>{settings.store_name.toUpperCase()}</h3>
          {settings.receipt_header && <p className="receipt-store">{settings.receipt_header}</p>}
          {settings.address && <p className="receipt-store">{settings.address}</p>}

          <div className="receipt-meta">
            <span>DATE:</span>
            <span>{date.toLocaleDateString()}</span>
          </div>
          <div className="receipt-meta">
            <span>TIME:</span>
            <span>{date.toLocaleTimeString()}</span>
          </div>
          <div className="receipt-meta">
            <span>ORDER #:</span>
            <span>{order.order_number}</span>
          </div>
          <div className="receipt-meta">
            <span>PAYMENT:</span>
            <span>{order.payment_method.toUpperCase()}</span>
          </div>

          <hr />

          {order.items.map((item) => (
            <div key={item.id} className="receipt-item-block">
              <div className="receipt-line">
                <span>
                  {item.quantity}x {item.product_name}
                </span>
                <span>₱{item.line_total.toFixed(2)}</span>
              </div>
              {item.modifiers && <div className="receipt-item-detail">{item.modifiers}</div>}
              {item.notes && <div className="receipt-item-detail">Note: {item.notes}</div>}
            </div>
          ))}

          <hr />

          <div className="receipt-line total">
            <span>TOTAL</span>
            <span>₱{order.total.toFixed(2)}</span>
          </div>

          {order.payment_method === "cash" && order.cash_tendered != null && (
            <>
              <div className="receipt-line">
                <span>Cash Tendered</span>
                <span>₱{order.cash_tendered.toFixed(2)}</span>
              </div>
              <div className="receipt-line">
                <span>Change</span>
                <span>₱{order.change.toFixed(2)}</span>
              </div>
            </>
          )}

          <p className="receipt-footer">{settings.receipt_footer}</p>
        </div>

        <div className="receipt-actions no-print">
          <button className="secondary-btn" onClick={handlePrint}>
            🖨 Print Receipt
          </button>
        </div>

        <form className="e-receipt-form no-print" onSubmit={handleEmailReceipt}>
          <label>Send E-Receipt</label>
          <div className="e-receipt-row">
            <input
              type="email"
              placeholder="customer@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
          {sentMessage && <div className="e-receipt-message">{sentMessage}</div>}
        </form>

        <button className="complete-btn no-print" onClick={() => navigate("/pos")}>
          Back to POS
        </button>
      </div>
    </div>
  );
}

export default Receipt;
