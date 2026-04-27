const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
const SERVER_DOWN_PATH = "/server-down";
const API_DOWN_EVENT = "api:server-down";
const API_RECOVERED_EVENT = "api:server-recovered";
const SERVER_DOWN_FLAG_KEY = "api_server_down";
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";
let hasSignaledServerDown = false;

function dispatchWindowEvent(name) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name));
}

function markServerDown() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SERVER_DOWN_FLAG_KEY, "1");
  if (hasSignaledServerDown) return;
  hasSignaledServerDown = true;
  dispatchWindowEvent(API_DOWN_EVENT);
}

export function isServerMarkedDown() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SERVER_DOWN_FLAG_KEY) === "1";
}

export function clearServerDownMark() {
  if (typeof window === "undefined") return;
  hasSignaledServerDown = false;
  sessionStorage.removeItem(SERVER_DOWN_FLAG_KEY);
  dispatchWindowEvent(API_RECOVERED_EVENT);
}

function isServerUnavailableStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

async function handleJson(res) {
  if (res.status === 204) {
    if (!res.ok) throw new Error(res.statusText || "Request failed");
    return null;
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "Invalid response" };
  }
  if (!res.ok) {
    const msg = data.error || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

async function request(path, options) {
  try {
    const token = getAuthToken();
    const headers = new Headers(options?.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
    if (isServerUnavailableStatus(res.status)) {
      markServerDown();
    }
    return await handleJson(res);
  } catch (err) {
    if (err instanceof TypeError) {
      markServerDown();
    }
    throw err;
  }
}

export function getAuthToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function setAuthToken(token) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function getStoredAuthUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
}

export async function register(body) {
  return request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function login(body) {
  return request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function logout() {
  return request("/api/auth/logout", {
    method: "POST",
  });
}

export async function changePassword(body) {
  return request("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getUsers() {
  return request("/api/users");
}

export function createUser(body) {
  return request("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function previewOrder(body) {
  return request("/api/orders/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function createOrder(body) {
  return request("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateOrder(userId, body) {
  return request(`/api/orders/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteOrder(userId, date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return request(`/api/orders/${userId}${q}`, {
    method: "DELETE",
  });
}

export function getOrderForUser(userId, date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return request(`/api/orders/${userId}${q}`);
}

export function getOrdersHistory({ from, to, userId }) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (userId) params.set("userId", userId);
  const q = params.toString();
  return request(`/api/orders${q ? `?${q}` : ""}`);
}

export function getHousekeeperAttendance({ from, to }) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = params.toString();
  return request(`/api/housekeeper${q ? `?${q}` : ""}`);
}

export function setHousekeeperAttendance(dateKey, present) {
  return request(`/api/housekeeper/${encodeURIComponent(dateKey)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ present }),
  });
}

export function getLightBillsForYear(year) {
  const y = Number(year);
  const params = new URLSearchParams();
  params.set("year", String(y));
  return request(`/api/light-bill?${params}`);
}

export function saveLightBillPeriod({ fromMonthKey, toMonthKey, amount }) {
  return request("/api/light-bill", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromMonthKey, toMonthKey, amount }),
  });
}

export function getDeposit() {
  return request("/api/deposit");
}

export function saveDeposit({ totalAmount, allocations }) {
  return request("/api/deposit", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ totalAmount, allocations }),
  });
}

export function getServerHealth() {
  return request("/health");
}

/**
 * How often to ping /health while the SPA is open. Render’s free web tier
 * typically spins down after ~15 minutes without traffic — stay under that
 * when at least one browser tab has your app open.
 *
 * This does **not** keep the API warm when nobody has the site open; use a
 * free uptime monitor (cron hitting GET /health) or a paid Render instance.
 */
export const HEALTH_KEEP_ALIVE_MS = 5 * 60 * 1000;

/** Background keep-alive; does not call markServerDown on failure. */
export async function pingHealthSilently() {
  try {
    await fetch(`${API_BASE}/health`, { method: "GET" });
  } catch {
    /* ignore */
  }
}

export { API_DOWN_EVENT, API_RECOVERED_EVENT, SERVER_DOWN_PATH };
