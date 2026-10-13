// Helpers for the logged-in user. Login.jsx saves "token" and "user" in localStorage.

// Where each page lives. Change these if your App.jsx uses different paths.
export const PAGE_PATHS = {
  pos: "/",
  kitchen: "/kitchen",
  inventory: "/inventory",
  reports: "/reports",
  shift: "/shift",
  settings: "/settings",
};

// Which pages each role can open. Admin manages everything.
export const ROLE_PAGES = {
  admin: [
    "pos",
    "receipt",
    "kitchen",
    "inventory",
    "reports",
    "shift",
    "settings",
  ],
  cashier: ["pos", "receipt"],
  kitchen: ["kitchen"],
};

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem("token");
}

export function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function canAccess(role, page) {
  return (ROLE_PAGES[role] || []).includes(page);
}

// First page a role is allowed to see - used after login and for blocked pages.
export function homePathFor(role) {
  const first = (ROLE_PAGES[role] || [])[0];
  return first ? PAGE_PATHS[first] : "/login";
}
