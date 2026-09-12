import React, { useEffect, useState } from "react";
import api from "../api";

function Settings() {
  const [form, setForm] = useState(null); // null while loading
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    api.get("/settings").then((res) => setForm(res.data));
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedMessage("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put("/settings", form);
      setForm(res.data);
      setSavedMessage("Settings saved.");
    } catch (err) {
      setSavedMessage("Could not save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return <div className="settings-page">Loading settings...</div>;
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <p>Manage your store configuration.</p>

      <form onSubmit={handleSave} className="settings-form">
        <div className="settings-card">
          <h3>Store Profile</h3>
          <p className="settings-hint">Manage your restaurant's public identity and contact information.</p>

          <label>Store Name</label>
          <input
            value={form.store_name}
            onChange={(e) => handleChange("store_name", e.target.value)}
          />

          <label>Address</label>
          <textarea
            rows="2"
            value={form.address || ""}
            onChange={(e) => handleChange("address", e.target.value)}
          />

          <div className="settings-row">
            <div>
              <label>Phone Number</label>
              <input
                value={form.phone || ""}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>
            <div>
              <label>Public Email</label>
              <input
                type="email"
                value={form.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="settings-card">
          <h3>Receipt Configuration</h3>
          <p className="settings-hint">Customize the appearance and content of printed and e-receipts.</p>

          <label>Header Message</label>
          <input
            value={form.receipt_header || ""}
            onChange={(e) => handleChange("receipt_header", e.target.value)}
          />

          <label>Footer Message</label>
          <input
            value={form.receipt_footer || ""}
            onChange={(e) => handleChange("receipt_footer", e.target.value)}
          />
        </div>

        <div className="settings-card">
          <h3>Financials</h3>
          <p className="settings-hint">Currency used across the POS.</p>
          <div className="settings-locked">
            <span>System Currency</span>
            <span className="settings-locked-value">₱ Philippine Peso (PHP)</span>
          </div>
        </div>

        {savedMessage && <div className="settings-saved-message">{savedMessage}</div>}

        <button type="submit" className="complete-btn" disabled={saving}>
          {saving ? "Saving..." : "Save All Settings"}
        </button>
      </form>
    </div>
  );
}

export default Settings;
