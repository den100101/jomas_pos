import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import CustomizeModal from "../components/CustomizeModal";

const QUICK_CASH = [50, 100, 200, 500, 1000];
// Categories where "Choose Rice" / egg style customization makes sense
const CUSTOMIZABLE_CATEGORIES = ["rice-meals"];

function makeLineKey(productId, modifiers, notes) {
  return `${productId}::${modifiers || ""}::${notes || ""}`;
}

function POS() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customizeTarget, setCustomizeTarget] = useState(null);
  const [cashInput, setCashInput] = useState("");
  const [placing, setPlacing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/categories").then((res) => {
      setCategories(res.data);
      if (res.data.length) setActiveCategory(res.data[0].slug);
    });
  }, []);

  useEffect(() => {
    if (!activeCategory) return;
    api.get(`/products?category=${activeCategory}`).then((res) => setProducts(res.data));
  }, [activeCategory]);

  const addLine = (product, extra = {}) => {
    const key = makeLineKey(product.id, extra.modifiers, extra.notes);
    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          key,
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          modifiers: extra.modifiers || null,
          notes: extra.notes || null,
        },
      ];
    });
  };

  const handleAddClick = (product) => {
    if (CUSTOMIZABLE_CATEGORIES.includes(activeCategory)) {
      setCustomizeTarget(product);
    } else {
      addLine(product);
    }
  };

  const changeQuantity = (key, delta) => {
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setCashInput("");
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = subtotal;

  const completeSale = async () => {
    if (!cart.length) return;
    setPlacing(true);

    try {
      const res = await api.post("/orders", {
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          modifiers: i.modifiers,
          notes: i.notes,
        })),
        payment_method: "cash",
        cash_tendered: cashInput ? parseFloat(cashInput) : total,
      });
      clearCart();
      navigate(`/receipt/${res.data.id}`);
    } catch (err) {
      alert("Could not complete the sale. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="pos-page">
      <div className="pos-catalog">
        <div className="category-tabs">
          {categories.map((c) => (
            <button
              key={c.id}
              className={`category-tab ${activeCategory === c.slug ? "active" : ""}`}
              onClick={() => setActiveCategory(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="product-grid">
          {products.map((p) => (
            <div key={p.id} className="product-card">
              <div className="product-name">{p.name}</div>
              <div className="product-price">₱{p.price.toFixed(2)}</div>
              <button className="add-btn" onClick={() => handleAddClick(p)}>
                {CUSTOMIZABLE_CATEGORIES.includes(activeCategory) ? "Customize & Add" : "+ Add to Cart"}
              </button>
            </div>
          ))}
          {!products.length && <div className="empty-state">No items in this category.</div>}
        </div>
      </div>

      <div className="pos-cart">
        <div className="cart-header">Active Ticket</div>

        <div className="cart-items">
          {cart.map((i) => (
            <div key={i.key} className="cart-item">
              <div className="cart-item-info">
                <div className="cart-item-name">{i.name}</div>
                <div className="cart-item-unit">
                  ₱{i.price.toFixed(2)} × {i.quantity}
                </div>
                {i.modifiers && <div className="cart-item-mod">{i.modifiers}</div>}
                {i.notes && <div className="cart-item-note">Note: {i.notes}</div>}
              </div>
              <div className="cart-item-controls">
                <button onClick={() => changeQuantity(i.key, -1)}>−</button>
                <span>{i.quantity}</span>
                <button onClick={() => changeQuantity(i.key, 1)}>+</button>
              </div>
              <div className="cart-item-total">₱{(i.price * i.quantity).toFixed(2)}</div>
            </div>
          ))}
          {!cart.length && <div className="empty-state">Cart is empty.</div>}
        </div>

        <div className="cart-summary">
          <div className="summary-row total">
            <span>TOTAL</span>
            <span>₱{total.toFixed(2)}</span>
          </div>
        </div>

        <button className="secondary-btn" onClick={clearCart}>
          Clear Cart
        </button>

        <div className="quick-cash">
          {QUICK_CASH.map((amt) => (
            <button key={amt} onClick={() => setCashInput(String(amt))}>
              ₱{amt}
            </button>
          ))}
        </div>
        <input
          className="cash-input"
          type="number"
          placeholder="Cash tendered (optional)"
          value={cashInput}
          onChange={(e) => setCashInput(e.target.value)}
        />

        <button
          className="complete-btn"
          onClick={completeSale}
          disabled={!cart.length || placing}
        >
          {placing ? "Processing..." : "Complete Sale (Cash)"}
        </button>
      </div>

      {customizeTarget && (
        <CustomizeModal
          product={customizeTarget}
          onClose={() => setCustomizeTarget(null)}
          onConfirm={(extra) => {
            addLine(customizeTarget, extra);
            setCustomizeTarget(null);
          }}
        />
      )}
    </div>
  );
}

export default POS;
