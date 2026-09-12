import React, { useEffect, useState } from "react";
import api from "../api";

function Inventory() {
  const [ingredients, setIngredients] = useState([]);
  const [restockAmounts, setRestockAmounts] = useState({});
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    unit: "kg",
    stock_quantity: "",
    reorder_level: "",
  });

  const loadIngredients = () => {
    api.get("/ingredients").then((res) => setIngredients(res.data));
  };

  useEffect(() => {
    loadIngredients();
  }, []);

  const handleRestock = async (ingredient) => {
    const amount = parseFloat(restockAmounts[ingredient.id]);
    if (!amount) return;
    await api.post(`/ingredients/${ingredient.id}/restock`, { amount });
    setRestockAmounts((prev) => ({ ...prev, [ingredient.id]: "" }));
    loadIngredients();
  };

  const handleAddIngredient = async (e) => {
    e.preventDefault();
    if (!newIngredient.name) return;

    await api.post("/ingredients", {
      name: newIngredient.name,
      unit: newIngredient.unit,
      stock_quantity: parseFloat(newIngredient.stock_quantity) || 0,
      reorder_level: parseFloat(newIngredient.reorder_level) || 0,
    });

    setNewIngredient({ name: "", unit: "kg", stock_quantity: "", reorder_level: "" });
    loadIngredients();
  };

  const lowStockCount = ingredients.filter((i) => i.low_stock).length;

  return (
    <div className="inventory-page">
      <h1>Inventory Dashboard</h1>
      <p>Real-time oversight of your kitchen and stock supplies.</p>

      <div className="reports-summary">
        <div className="reports-card">
          <div className="reports-label">Total Ingredients</div>
          <div className="reports-value">{ingredients.length}</div>
        </div>
        <div className="reports-card" style={lowStockCount ? { background: "#fdeceb" } : {}}>
          <div className="reports-label">Low Stock Items</div>
          <div className="reports-value" style={lowStockCount ? { color: "#d64545" } : {}}>
            {lowStockCount}
          </div>
        </div>
      </div>

      <table className="reports-table">
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Unit</th>
            <th>On Hand</th>
            <th>Reorder Level</th>
            <th>Status</th>
            <th>Restock</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td>
              <td>{i.unit}</td>
              <td>{i.stock_quantity}</td>
              <td>{i.reorder_level}</td>
              <td>
                <span className={`status-pill ${i.low_stock ? "low" : "ok"}`}>
                  {i.low_stock ? "Low Stock" : "In Stock"}
                </span>
              </td>
              <td>
                <div className="restock-row">
                  <input
                    type="number"
                    placeholder="Qty"
                    value={restockAmounts[i.id] || ""}
                    onChange={(e) =>
                      setRestockAmounts((prev) => ({ ...prev, [i.id]: e.target.value }))
                    }
                  />
                  <button onClick={() => handleRestock(i)}>Add</button>
                </div>
              </td>
            </tr>
          ))}
          {!ingredients.length && (
            <tr>
              <td colSpan="6" className="empty-state">
                No ingredients yet. Add one below.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="new-ingredient-form" onSubmit={handleAddIngredient}>
        <h3>Add New Ingredient</h3>
        <div className="form-row">
          <input
            placeholder="Name (e.g. Jasmine Rice)"
            value={newIngredient.name}
            onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
          />
          <select
            value={newIngredient.unit}
            onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
          >
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="l">l</option>
            <option value="ml">ml</option>
            <option value="pcs">pcs</option>
          </select>
          <input
            type="number"
            placeholder="Starting stock"
            value={newIngredient.stock_quantity}
            onChange={(e) =>
              setNewIngredient({ ...newIngredient, stock_quantity: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Reorder level"
            value={newIngredient.reorder_level}
            onChange={(e) =>
              setNewIngredient({ ...newIngredient, reorder_level: e.target.value })
            }
          />
          <button type="submit" className="complete-btn">
            Add Ingredient
          </button>
        </div>
      </form>
    </div>
  );
}

export default Inventory;
