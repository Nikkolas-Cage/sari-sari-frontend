const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

let tokenGetter = null;

export function setTokenGetter(fn) {
  tokenGetter = fn;
}

async function getToken() {
  if (!tokenGetter) return null;
  return tokenGetter();
}

async function request(path, options = {}) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = res.status;
    error.code = data.code;
    error.payload = data;
    throw error;
  }

  return data;
}

export const api = {
  session: (body) => request("/auth/session", { method: "POST", body: JSON.stringify(body) }),
  register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/auth/me"),
  updateProfile: (body) =>
    request("/auth/profile", { method: "PATCH", body: JSON.stringify(body) }),

  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  getProductByBarcode: (code) => request(`/products/barcode/${encodeURIComponent(code)}`),
  createProduct: (body) => request("/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  addStock: (id, quantity) =>
    request(`/products/${id}/stock`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),

  checkout: (body) => request("/sales", { method: "POST", body: JSON.stringify(body) }),
  getSales: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/sales${qs ? `?${qs}` : ""}`);
  },
  getStores: () => request("/sales/stores"),

  getConversations: () => request("/chat/conversations"),
  startConversation: (otherUserId) =>
    request("/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ otherUserId }),
    }),
  getMessages: (conversationId) => request(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, text, attachments = []) =>
    request(`/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text, attachments }),
    }),
  getChatDirectory: () => request("/chat/directory"),
  inquireProduct: (body) => request("/chat/inquire", { method: "POST", body: JSON.stringify(body) }),
  markChatRead: (conversationId) =>
    request(`/chat/conversations/${conversationId}/read`, { method: "POST", body: "{}" }),
  markChatDelivered: (conversationId) =>
    request(`/chat/conversations/${conversationId}/delivered`, { method: "POST", body: "{}" }),
  updateOrderStatus: (id, status) =>
    request(`/sales/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  trackProductView: (id) => request(`/products/${id}/view`, { method: "POST", body: "{}" }),
  trackProductClick: (id) => request(`/products/${id}/click`, { method: "POST", body: "{}" }),
  getAnalytics: () => request("/products/analytics"),

  getNotifications: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/notifications${qs ? `?${qs}` : ""}`);
  },
  getUnreadNotificationCount: () => request("/notifications/unread-count"),
  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, { method: "PATCH", body: "{}" }),
  markAllNotificationsRead: () =>
    request("/notifications/read-all", { method: "PATCH", body: "{}" }),
  notifyCartAdd: (productId) =>
    request("/notifications/cart-add", {
      method: "POST",
      body: JSON.stringify({ productId }),
    }),
};

export function saveUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("user");
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
