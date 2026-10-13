// Helpers for the logged-in user. Login.jsx saves "token" and "user" in localStorage.

// Where each page lives (these match the routes in App.jsx).
export const PAGE_PATHS = {
  pos: "/pos",
  kitchen: "/kitchen",
  inventory: "/inventory",
  reports: "/reports",
  shift: "/shift",
  settings: "/settings",
};

// Which pages each role can open. Admin manages everything.
// "receipt" is the receipt screen shown after a sale (/receipt/:orderId).
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

export function canAccess(role, page) {
  return (ROLE_PAGES[role] || []).includes(page);
}

// First page a role is allowed to see - used after login and for blocked pages.
export function homePathFor(role) {
  const first = (ROLE_PAGES[role] || [])[0];
  return PAGE_PATHS[first] || "/pos";
}
