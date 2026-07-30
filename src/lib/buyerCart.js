const STORAGE_KEY = "buyerCart";

export function readBuyerCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeBuyerCart(cart) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart || []));
}

export function clearBuyerCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
