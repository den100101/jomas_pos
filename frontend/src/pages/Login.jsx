import React, { useState } from "react";
import api from "../api";

function Login({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/login", { username, password });
      if (res.data.success) {
        localStorage.setItem("token", res.data.access_token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        onLogin(res.data.user);
      } else {
        setError(res.data.message || "Invalid credentials");
      }
    } catch (err) {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-wrap">
        <div className="login-brand">
          <span className="brand-icon">🔥</span> JoMa's
        </div>
        <h1>Arroz Frito Portal</h1>
        <p className="login-tagline">
          Professional management for the perfect sizzle
        </p>

        <div className="login-card">
          <h2>Internal Sign In</h2>
          <p className="login-hint">
            Enter your credentials to access the kitchen dashboard
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="username">Email or Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="chef@jomas.com"
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Signing in..." : "Sign In to Dashboard"}
            </button>
          </form>

          <div className="login-footer">
            PROTECTED BY JOMA'S SECURITY SYSTEMS
          </div>
        </div>

        <p className="login-copyright">
          © 2026 JoMa's Arroz Frito Co. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default Login;
