const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
const SERVER_DOWN_PATH = "/server-down";
const API_DOWN_EVENT = "api:server-down";
const API_RECOVERED_EVENT = "api:server-recovered";
const SERVER_DOWN_FLAG_KEY = "api_server_down";
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
    const res = await fetch(`${API_BASE}${path}`, options);
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

export function getServerHealth() {
  return request("/health");
}

export { API_DOWN_EVENT, API_RECOVERED_EVENT, SERVER_DOWN_PATH };
