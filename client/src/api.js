function resolveApiBase() {
  const raw = import.meta.env.VITE_API_URL?.trim() || "";
  // Allow relative API bases (e.g. "/api") for same-origin deployments.
  if (raw.startsWith("/")) return raw.replace(/\/$/, "");
  // Dev: same-origin via Vite proxy so LAN/mobile hits :5173, not unreachable :5000/localhost.
  if (import.meta.env.DEV) {
    const pointsAtLocalApi =
      !raw || /localhost|127\.0\.0\.1/i.test(raw);
    if (pointsAtLocalApi) return "";
  }
  if (!raw) {
    if (typeof window === "undefined") return "http://localhost:5000";
    // Production fallback: same-origin avoids CORS when app/API are behind one domain/proxy.
    if (!import.meta.env.DEV) return "";
    const h = window.location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1";
    if (isLocal) return "http://localhost:5000";
    const proto = window.location.protocol === "https:" ? "https:" : "http:";
    return `${proto}//${h}:5000`;
  }
  const normalized = raw.replace(/\/$/, "");
  if (typeof window === "undefined") return normalized;
  try {
    const u = new URL(normalized);
    const pageHost = window.location.hostname;
    const isLocalApiHost =
      u.hostname === "localhost" || u.hostname === "127.0.0.1";
    const isLocalPageHost =
      pageHost === "localhost" || pageHost === "127.0.0.1";
    if (isLocalApiHost && !isLocalPageHost) {
      u.hostname = pageHost;
      return u.toString().replace(/\/$/, "");
    }
  } catch {
    // keep normalized
  }
  return normalized;
}

const API_BASE = resolveApiBase();

const TOKEN_KEY = "tiffin_token";

export function getStoredToken() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Path without query or hash — public-route checks must not depend on `?…`. */
function apiPathname(path) {
  const s = String(path);
  const q = s.indexOf("?");
  const h = s.indexOf("#");
  const end =
    q === -1 && h === -1
      ? s.length
      : q === -1
        ? h
        : h === -1
          ? q
          : Math.min(q, h);
  return s.slice(0, end);
}

/** Headers that skip attaching Bearer (public or non-user APIs). */
function authHeaderForPath(path) {
  const token = getStoredToken();
  if (!token) return {};
  const p = apiPathname(path);
  const noBearer =
    p === "/health" ||
    p === "/api/orders/preview" ||
    p === "/api/auth/register-org" ||
    p === "/api/auth/register-member" ||
    p === "/api/auth/login";
  if (noBearer) return {};
  return { Authorization: `Bearer ${token}` };
}
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

async function request(path, options = {}) {
  const mergedHeaders = {
    ...authHeaderForPath(path),
    ...(options.headers && typeof options.headers === "object"
      ? options.headers
      : {}),
  };
  const fetchOptions = { ...options, headers: mergedHeaders };
  try {
    const res = await fetch(`${API_BASE}${path}`, fetchOptions);
    return await handleJson(res);
  } catch (err) {
    if (err instanceof TypeError) {
      const host =
        typeof window !== "undefined" ? window.location.origin : "unknown origin";
      throw new Error(
        `Network error calling ${API_BASE}${path} from ${host}. Check API URL/CORS and that backend is reachable.`
      );
    }
    throw err;
  }
}

export function loginRequest(body) {
  return request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function registerOrgRequest(body) {
  return request("/api/auth/register-org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function registerMemberRequest(body) {
  return request("/api/auth/register-member", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function authMe() {
  return request("/api/auth/me");
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

export function patchMyUsername(username) {
  return request("/api/users/me/username", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
}

export function patchUserUsername(userId, username) {
  return request(
    `/api/users/${encodeURIComponent(userId)}/username`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    }
  );
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

/** Background keep-alive; owns server-down signaling. */
export async function pingHealthSilently() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (res.ok) {
      clearServerDownMark();
      return;
    }
    markServerDown();
  } catch {
    markServerDown();
  }
}

export { API_DOWN_EVENT, API_RECOVERED_EVENT, SERVER_DOWN_PATH };
