import React, { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import RequireRole from "./components/RequireRole";
import Login from "./pages/Login";
import POS from "./pages/POS";
import Receipt from "./pages/Receipt";
import Kitchen from "./pages/Kitchen";
import Inventory from "./pages/Inventory";
import Reports from "./pages/Reports";
import Shift from "./pages/Shift";
import Settings from "./pages/Settings";
import { ROLE_PAGES, getUser, homePathFor } from "./utils/auth";

function App() {
  const [user, setUser] = useState(getUser);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  // Not logged in (or a saved user with a role we don't recognise) -> login screen.
  if (!user || !ROLE_PAGES[user.role]) {
    return <Login onLogin={setUser} />;
  }

  const home = homePathFor(user.role);

  // Only let the right roles open each page.
  const guard = (page, element) => (
    <RequireRole user={user} page={page}>
      {element}
    </RequireRole>
  );

  return (
    <BrowserRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route path="/pos" element={guard("pos", <POS />)} />
          <Route
            path="/receipt/:orderId"
            element={guard("receipt", <Receipt />)}
          />
          <Route path="/kitchen" element={guard("kitchen", <Kitchen />)} />
          <Route
            path="/inventory"
            element={guard("inventory", <Inventory />)}
          />
          <Route path="/reports" element={guard("reports", <Reports />)} />
          <Route path="/shift" element={guard("shift", <Shift />)} />
          <Route path="/settings" element={guard("settings", <Settings />)} />
          {/* Any other address (including /login after a session expires) goes home */}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
