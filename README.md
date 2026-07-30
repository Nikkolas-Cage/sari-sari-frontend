# Sari-Sari Store — Frontend

**Final submission of Nico Guarnes**  
**MITC 702 — Advance Database Systems (2026)**

Web client for **Choice A: The Sari-Sari Store System** (The “Data Integrity” Path).

---

## Project choice & platform

| Item | Decision |
|------|----------|
| **App** | **A.** Sari-Sari Store System |
| **Platform** | **Web** (Next.js Progressive Web App–ready UI) |
| **Auth** | Firebase Authentication |
| **Business data** | MongoDB via Express API (products, sales, orders, chat) |

### Technical justification (Web)

A sari-sari store needs a **shared counter / tablet / PC** experience more than a phone-only app:

- **POS & stock** work best on a larger screen (cart, barcode camera/upload, product grid).
- **Buyers and sellers** can use the same URL from any device—no app-store install.
- **Realtime sync** (WebSockets) keeps stock, pickup orders, chat, and analytics aligned across roles.
- Camera barcode scanning and gallery image pick still work in modern browsers (ZXing + file input), meeting the barcode/image requirements without locking to Android ML Kit alone.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | **Next.js 16** (Pages Router) |
| UI | **React 19**, **Chakra UI**, Framer Motion |
| Auth | **Firebase Auth** (Email/Password, Google, Phone) |
| Charts | **Recharts** |
| Barcodes | **@zxing/browser** (scan), **JsBarcode** (CODE128 export) |
| Realtime | Native **WebSocket** client → backend `/ws` |
| API | REST → `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api`) |

---

## Core features

### Required modules (Choice A)

1. **Stock entry & management**
   - Product registration (name, category, unit price, stock, low-stock threshold, description)
   - Add / update stock workflow for existing products
   - **Barcode integration** — camera scan or JPG upload; lookup fetches current product/stock from the API
   - **Image attachment** — capture or gallery pick; image stored with the product record
   - Low-stock filter and visual alerts

2. **Point of Sale (selling)**
   - Virtual cart with multi-item checkout
   - Stock validation before sale (`requestedQuantity > currentStock` → warning)
   - Checkout deducts inventory and writes **Sales History**
   - Realtime UI refresh via WebSockets when products/sales change

3. **Data visualization & history**
   - Sales history with totals and timestamps
   - Low-stock indicators on dashboard / products
   - Seller analytics charts (views, clicks, categories)

### Dual roles

| Seller | Buyer |
|--------|--------|
| Dashboard, Products, POS, Sales | Shop browse & search |
| Pickup order management | Cart → pickup request |
| Analytics, notifications, messages | Orders, notifications, messages |
| Store profile / settings | Profile / settings |

### Value-added features (beyond the brief)

1. **Buyer–seller pickup marketplace** — buyers request store pickup; sellers confirm → ready → completed, with notifications.
2. **Realtime chat & product inquire** — floating chat, typing indicators, delivery/read receipts, image attachments.
3. **Engagement analytics** — product view/click tracking with **live charts** when buyers interact.
4. **Barcode generate/export** — CODE128 labels for labeled inventory.
5. **Unified auth session** — role-aware profiles (seller store name vs username), social/phone login.

---

## How to run

### Prerequisites

- Node.js 18+
- Backend running on port **3001** (see [sari-sari-backend](https://github.com/Nikkolas-Cage/sari-sari-backend))
- Firebase Web app credentials (same project as the backend Admin SDK)

### 1. Install

```bash
cd sari-sari-frontend
npm install
```

### 2. Environment

Copy `.env.local.example` → `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Optional:

```env
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
```

### 3. Start

```bash
npm run dev
```

Open **http://localhost:3000**

### 4. Production build

```bash
npm run build
npm start
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |

---

## Course deliverables (context)

1. **Complete functional system** — this frontend + companion backend repos  
2. **Video demonstration** — walkthrough of stock, POS, history, and value-adds  
3. **Description & justification** — Web platform + Firebase Auth + MongoDB API (this README)

---

## Author

**Nico G. Guarnes**  
MITC 702 — Advance Database Systems (2026)
