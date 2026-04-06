const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

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

export function getUsers() {
  return fetch(`${API_BASE}/api/users`).then(handleJson);
}

export function createUser(body) {
  return fetch(`${API_BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handleJson);
}

export function previewOrder(body) {
  return fetch(`${API_BASE}/api/orders/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handleJson);
}

export function createOrder(body) {
  return fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handleJson);
}

export function updateOrder(userId, body) {
  return fetch(`${API_BASE}/api/orders/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handleJson);
}

export function deleteOrder(userId, date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return fetch(`${API_BASE}/api/orders/${userId}${q}`, {
    method: "DELETE",
  }).then(handleJson);
}

export function getOrderForUser(userId, date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return fetch(`${API_BASE}/api/orders/${userId}${q}`).then(handleJson);
}

export function getOrdersHistory({ from, to, userId }) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (userId) params.set("userId", userId);
  const q = params.toString();
  return fetch(
    `${API_BASE}/api/orders${q ? `?${q}` : ""}`
  ).then(handleJson);
}
