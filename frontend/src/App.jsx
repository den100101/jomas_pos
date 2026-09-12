import React, { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import Login from "./pages/Login";
import POS from "./pages/POS";
import Receipt from "./pages/Receipt";
import Kitchen from "./pages/Kitchen";
import Inventory from "./pages/Inventory";
import Reports from "./pages/Reports";
import Shift from "./pages/Shift";
import Settings from "./pages/Settings";

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <BrowserRouter>
      <Layout user={user} onLogout={() => setUser(null)}>
        <Routes>
          <Route path="/" element={<Navigate to="/pos" replace />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/receipt/:orderId" element={<Receipt />} />
          <Route path="/kitchen" element={<Kitchen />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/shift" element={<Shift />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
