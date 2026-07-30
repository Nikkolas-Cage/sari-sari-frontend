const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api$/, "").replace(/^http/, "ws") +
    "/ws";

let socket = null;
let listeners = new Set();
let reconnectTimer = null;

export function getWsUrl(token) {
  return `${WS_URL}?token=${encodeURIComponent(token)}`;
}

export function subscribeRealtime(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function emit(msg) {
  for (const handler of listeners) {
    try {
      handler(msg);
    } catch (err) {
      console.error(err);
    }
  }
}

export function sendRealtime(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

export async function connectRealtime(getToken) {
  if (typeof window === "undefined") return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const token = await getToken();
  if (!token) return;

  socket = new WebSocket(getWsUrl(token));

  socket.onmessage = (event) => {
    try {
      emit(JSON.parse(event.data));
    } catch {
      // ignore
    }
  };

  socket.onclose = () => {
    socket = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connectRealtime(getToken), 3000);
  };

  socket.onerror = () => {
    socket?.close();
  };
}

export function disconnectRealtime() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (socket) {
    socket.close();
    socket = null;
  }
}
