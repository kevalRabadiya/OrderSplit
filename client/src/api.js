const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

async function handleJson(res) {
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

export function getOrderForUser(userId, date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return fetch(`${API_BASE}/api/orders/${userId}${q}`).then(handleJson);
}
