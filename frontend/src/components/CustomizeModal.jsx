import React, { useState } from "react";

const RICE_CHOICES = ["Java", "Curry", "Egg Rice", "Nasi Goreng", "Yangchow", "Turmeric", "Plain Rice"];
const EGG_STYLES = ["Sunny Side Up", "Scrambled", "No Egg"];

function CustomizeModal({ product, onConfirm, onClose }) {
  const [rice, setRice] = useState(RICE_CHOICES[0]);
  const [egg, setEgg] = useState(EGG_STYLES[0]);
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onConfirm({
      modifiers: `Rice: ${rice}, Egg: ${egg}`,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Customize: {product.name}</h3>
        <p className="modal-price">₱{product.price.toFixed(2)}</p>

        <label>Rice Choice</label>
        <select value={rice} onChange={(e) => setRice(e.target.value)}>
          {RICE_CHOICES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <label>Egg Style</label>
        <select value={egg} onChange={(e) => setEgg(e.target.value)}>
          {EGG_STYLES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        <label>Special Instructions</label>
        <textarea
          rows="2"
          placeholder="e.g. less spicy, no onions..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="complete-btn" onClick={handleConfirm}>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomizeModal;
