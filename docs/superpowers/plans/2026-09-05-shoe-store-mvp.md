# Shoe Store MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first shoe store MVP where customers can search, view, buy shoes with COD, track orders, and use an AI product advisor while admins manage products, stock, and orders.

**Architecture:** Create a `shoe-store/` monorepo with a React/Vite client, Express API server, and PostgreSQL schema/seed files. The server owns auth, validation, business rules, and database access; the client consumes JSON APIs through `VITE_API_URL`.

**Tech Stack:** React, Vite, React Router, Node.js, Express, PostgreSQL, `pg`, `bcryptjs`, `jsonwebtoken`, Vitest, Supertest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-05-shoe-store-mvp-design.md`

## Global Constraints

- Create the app in `shoe-store/` so existing unrelated files are not touched.
- Frontend dev server must bind `0.0.0.0` on port `5173`.
- Backend API must bind `0.0.0.0` on port `5000`.
- Authentication is backend-owned JWT auth.
- Passwords must be hashed with `bcryptjs`.
- Customer role is `customer`; admin role is `admin`.
- Payment method is COD only in MVP.
- Initial order state is `order_status='pending'` and `payment_status='unpaid'`.
- Completing an order sets `order_status='completed'` and `payment_status='paid'`.
- AI advisor must work without an OpenAI API key by using a deterministic catalog fallback.
- API errors must be JSON with shape `{ "message": "...", "details": ... }`.

---

## File Structure

Create:

```text
shoe-store/
  package.json
  README.md
  .gitignore
  database/
    schema.sql
    seed.sql
  server/
    package.json
    .env.example
    src/
      app.js
      server.js
      config/env.js
      db/pool.js
      db/transactions.js
      middleware/auth.js
      middleware/errorHandler.js
      utils/asyncHandler.js
      utils/httpError.js
      modules/auth/auth.routes.js
      modules/auth/auth.service.js
      modules/products/products.routes.js
      modules/products/products.service.js
      modules/cart/cart.routes.js
      modules/cart/cart.service.js
      modules/orders/orders.routes.js
      modules/orders/orders.service.js
      modules/admin/admin.routes.js
      modules/admin/admin.service.js
      modules/ai/ai.routes.js
      modules/ai/ai.service.js
      test/setup.js
      test/auth.test.js
      test/products.test.js
      test/cart-orders.test.js
      test/admin.test.js
      test/ai.test.js
  client/
    package.json
    index.html
    vite.config.js
    src/
      main.jsx
      App.jsx
      api/client.js
      auth/AuthContext.jsx
      cart/CartContext.jsx
      components/Layout.jsx
      components/ProductCard.jsx
      components/StatusBadge.jsx
      components/AiAssistant.jsx
      pages/HomePage.jsx
      pages/ProductListPage.jsx
      pages/ProductDetailPage.jsx
      pages/CartPage.jsx
      pages/CheckoutPage.jsx
      pages/OrdersPage.jsx
      pages/OrderDetailPage.jsx
      pages/LoginPage.jsx
      pages/RegisterPage.jsx
      pages/admin/AdminLayout.jsx
      pages/admin/AdminDashboardPage.jsx
      pages/admin/AdminProductsPage.jsx
      pages/admin/AdminProductFormPage.jsx
      pages/admin/AdminOrdersPage.jsx
      pages/admin/AdminOrderDetailPage.jsx
      styles.css
      test/App.test.jsx
      test/customer-flow.test.jsx
      test/admin-flow.test.jsx
```

---

### Task 1: Monorepo Scaffold and Local Scripts

**Files:**
- Create: `shoe-store/package.json`
- Create: `shoe-store/.gitignore`
- Create: `shoe-store/README.md`
- Create: `shoe-store/server/package.json`
- Create: `shoe-store/server/.env.example`
- Create: `shoe-store/server/src/config/env.js`
- Create: `shoe-store/server/src/app.js`
- Create: `shoe-store/server/src/server.js`
- Create: `shoe-store/server/src/middleware/errorHandler.js`
- Create: `shoe-store/server/src/utils/asyncHandler.js`
- Create: `shoe-store/server/src/utils/httpError.js`
- Create: `shoe-store/client/package.json`
- Create: `shoe-store/client/index.html`
- Create: `shoe-store/client/vite.config.js`
- Create: `shoe-store/client/src/main.jsx`
- Create: `shoe-store/client/src/App.jsx`
- Create: `shoe-store/client/src/styles.css`

**Interfaces:**
- Produces: `createApp(): Express.Application` exported from `server/src/app.js`.
- Produces: `env` object from `server/src/config/env.js`.
- Produces: root scripts `npm run dev`, `npm run test`, `npm run build`.

- [ ] **Step 1: Create root workspace files**

Create `shoe-store/package.json`:

```json
{
  "name": "shoe-store",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace server\" \"npm run dev --workspace client\"",
    "test": "npm run test --workspace server && npm run test --workspace client",
    "build": "npm run build --workspace client",
    "db:setup": "psql \"$DATABASE_URL\" -f database/schema.sql && psql \"$DATABASE_URL\" -f database/seed.sql"
  },
  "workspaces": [
    "server",
    "client"
  ],
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
.DS_Store
coverage/
```

- [ ] **Step 2: Create Express base**

Create `server/src/app.js`:

```js
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'shoe-store-api' });
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
```

Create `server/src/server.js`:

```js
const { createApp } = require('./app');
const { env } = require('./config/env');

const app = createApp();
app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`API listening on http://0.0.0.0:${env.PORT}`);
});
```

- [ ] **Step 3: Create React base**

Create `client/src/App.jsx`:

```jsx
export default function App() {
  return (
    <main className="app-shell">
      <h1>Shoe Store</h1>
      <p>Local shoe store MVP is running.</p>
    </main>
  );
}
```

Create `client/src/main.jsx`:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Run scaffold checks**

Run:

```bash
cd shoe-store
npm install
npm run test
npm run build
```

Expected: client test/build commands run with no application errors after test scripts are in place or report no tests only during this scaffold task.

- [ ] **Step 5: Commit**

```bash
git add shoe-store
git commit -m "chore: scaffold shoe store app"
```

---

### Task 2: PostgreSQL Schema, Seed Data, and DB Helpers

**Files:**
- Create: `shoe-store/database/schema.sql`
- Create: `shoe-store/database/seed.sql`
- Create: `shoe-store/server/src/db/pool.js`
- Create: `shoe-store/server/src/db/transactions.js`
- Create: `shoe-store/server/test/setup.js`

**Interfaces:**
- Produces: `query(text, params)` from `server/src/db/pool.js`.
- Produces: `withTransaction(callback)` from `server/src/db/transactions.js`.
- Database tables match the spec: `users`, `products`, `product_images`, `product_variants`, `carts`, `cart_items`, `orders`, `order_items`, `ai_chat_messages`.

- [ ] **Step 1: Write schema**

Create PostgreSQL enums and tables. Required enums:

```sql
CREATE TYPE user_role AS ENUM ('customer', 'admin');
CREATE TYPE product_status AS ENUM ('active', 'hidden');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipping', 'completed', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cod');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid');
```

Required constraints:

```sql
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE products ADD CONSTRAINT products_slug_unique UNIQUE (slug);
ALTER TABLE product_variants ADD CONSTRAINT product_variants_sku_unique UNIQUE (sku);
ALTER TABLE product_variants ADD CONSTRAINT product_variants_stock_nonnegative CHECK (stock_quantity >= 0);
ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);
```

- [ ] **Step 2: Seed local data**

Create seed users:

```text
Admin: admin@shoestore.local / Admin123!
Customer: customer@shoestore.local / Customer123!
```

Seed at least 8 products with multiple sizes/colors and public image URLs from stable placeholder images, enough for search/filter/AI tests.

- [ ] **Step 3: Add DB helpers**

Create `server/src/db/pool.js`:

```js
const { Pool } = require('pg');
const { env } = require('../config/env');

const pool = new Pool({ connectionString: env.DATABASE_URL });

function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
```

Create `server/src/db/transactions.js`:

```js
const { pool } = require('./pool');

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
```

- [ ] **Step 4: Verify database setup**

Run:

```bash
cd shoe-store
npm run db:setup
psql "$DATABASE_URL" -c "select count(*) from products;"
```

Expected: count is at least `8`.

- [ ] **Step 5: Commit**

```bash
git add shoe-store/database shoe-store/server/src/db shoe-store/server/test/setup.js shoe-store/package.json
git commit -m "feat: add shoe store database schema"
```

---

### Task 3: Backend Auth API

**Files:**
- Create: `shoe-store/server/src/modules/auth/auth.routes.js`
- Create: `shoe-store/server/src/modules/auth/auth.service.js`
- Create: `shoe-store/server/src/middleware/auth.js`
- Create: `shoe-store/server/test/auth.test.js`
- Modify: `shoe-store/server/src/app.js`

**Interfaces:**
- Produces: `POST /api/auth/register`.
- Produces: `POST /api/auth/login`.
- Produces: `GET /api/auth/me`.
- Produces: `requireAuth(req,res,next)` and `requireAdmin(req,res,next)`.
- Produces: `req.user = { id, email, name, role }`.

- [ ] **Step 1: Write failing auth tests**

Create tests for:

```js
it('registers a customer and returns a token');
it('logs in an existing user and returns profile data');
it('rejects login with wrong password using 401 JSON');
it('returns current user from bearer token');
it('rejects admin middleware for customer token');
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd shoe-store/server
npm test -- auth.test.js
```

Expected: FAIL because auth routes do not exist.

- [ ] **Step 3: Implement auth service**

Required service functions:

```js
async function registerCustomer({ name, email, password }) {}
async function login({ email, password }) {}
async function getUserById(id) {}
function signToken(user) {}
function publicUser(row) {}
```

Validation rules:

- Name required.
- Email must contain `@`.
- Password must be at least 8 characters.
- Duplicate email returns `409`.

- [ ] **Step 4: Implement auth middleware**

Middleware behavior:

```js
requireAuth: missing token -> 401
requireAuth: invalid token -> 401
requireAdmin: authenticated non-admin -> 403
```

- [ ] **Step 5: Wire routes into app**

Add to `createApp()`:

```js
app.use('/api/auth', authRoutes);
```

- [ ] **Step 6: Run auth tests**

Run:

```bash
cd shoe-store/server
npm test -- auth.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add shoe-store/server
git commit -m "feat: add jwt authentication"
```

---

### Task 4: Product Catalog API

**Files:**
- Create: `shoe-store/server/src/modules/products/products.routes.js`
- Create: `shoe-store/server/src/modules/products/products.service.js`
- Create: `shoe-store/server/test/products.test.js`
- Modify: `shoe-store/server/src/app.js`

**Interfaces:**
- Produces: `GET /api/products`.
- Produces: `GET /api/products/:slug`.
- Product list accepts query params: `q`, `brand`, `category`, `gender`, `size`, `color`, `minPrice`, `maxPrice`, `sort`.

- [ ] **Step 1: Write failing product tests**

Create tests for:

```js
it('lists active products with images and available variants');
it('filters products by keyword');
it('filters products by size and color');
it('sorts products by price ascending');
it('returns one product by slug');
it('returns 404 JSON for missing slug');
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd shoe-store/server
npm test -- products.test.js
```

Expected: FAIL because product routes do not exist.

- [ ] **Step 3: Implement product SQL queries**

Use parameterized SQL. Product cards must include:

```js
{
  id,
  name,
  slug,
  brand,
  category,
  gender,
  price,
  imageUrl,
  availableSizes,
  availableColors,
  totalStock
}
```

Product detail must include images and variants.

- [ ] **Step 4: Wire product routes**

Add:

```js
app.use('/api/products', productRoutes);
```

- [ ] **Step 5: Run product tests**

Run:

```bash
cd shoe-store/server
npm test -- products.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shoe-store/server/src/modules/products shoe-store/server/test/products.test.js shoe-store/server/src/app.js
git commit -m "feat: add product catalog api"
```

---

### Task 5: Cart and COD Order API

**Files:**
- Create: `shoe-store/server/src/modules/cart/cart.routes.js`
- Create: `shoe-store/server/src/modules/cart/cart.service.js`
- Create: `shoe-store/server/src/modules/orders/orders.routes.js`
- Create: `shoe-store/server/src/modules/orders/orders.service.js`
- Create: `shoe-store/server/test/cart-orders.test.js`
- Modify: `shoe-store/server/src/app.js`

**Interfaces:**
- Produces: `GET /api/cart`.
- Produces: `POST /api/cart/items`.
- Produces: `PATCH /api/cart/items/:id`.
- Produces: `DELETE /api/cart/items/:id`.
- Produces: `POST /api/orders`.
- Produces: `GET /api/orders`.
- Produces: `GET /api/orders/:id`.

- [ ] **Step 1: Write failing cart/order tests**

Create tests for:

```js
it('requires auth to view cart');
it('adds a product variant to the customer cart');
it('rejects cart quantity above stock with 409 JSON');
it('updates and removes cart items');
it('creates a COD order from cart and clears cart');
it('decrements stock when order is created');
it('lists only the authenticated customer orders');
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd shoe-store/server
npm test -- cart-orders.test.js
```

Expected: FAIL because cart/order routes do not exist.

- [ ] **Step 3: Implement cart service**

Required functions:

```js
async function getOrCreateCart(userId) {}
async function getCart(userId) {}
async function addCartItem(userId, { variantId, quantity }) {}
async function updateCartItem(userId, itemId, { quantity }) {}
async function removeCartItem(userId, itemId) {}
```

Rules:

- Variant must exist.
- Quantity must be positive.
- Total requested quantity cannot exceed `stock_quantity`.
- Users can mutate only their own cart.

- [ ] **Step 4: Implement order creation transaction**

Required function:

```js
async function createCodOrder(userId, { receiverName, phone, shippingAddress, note }) {}
```

Transaction rules:

- Lock selected variants with `FOR UPDATE`.
- Reject empty cart with `400`.
- Reject insufficient stock with `409`.
- Insert `orders` with `payment_method='cod'`, `payment_status='unpaid'`, `order_status='pending'`.
- Insert `order_items` snapshots.
- Decrement stock.
- Clear cart.

- [ ] **Step 5: Implement customer order listing/detail**

Rules:

- Customer can see only orders where `orders.user_id = req.user.id`.
- Missing own order returns `404`.
- Another user's order returns `404`, not `403`, to avoid leaking existence.

- [ ] **Step 6: Wire routes**

Add:

```js
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
```

- [ ] **Step 7: Run tests**

Run:

```bash
cd shoe-store/server
npm test -- cart-orders.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add shoe-store/server
git commit -m "feat: add cart and cod order api"
```

---

### Task 6: Admin API

**Files:**
- Create: `shoe-store/server/src/modules/admin/admin.routes.js`
- Create: `shoe-store/server/src/modules/admin/admin.service.js`
- Create: `shoe-store/server/test/admin.test.js`
- Modify: `shoe-store/server/src/app.js`

**Interfaces:**
- Produces: `GET /api/admin/dashboard`.
- Produces: `GET /api/admin/products`.
- Produces: `POST /api/admin/products`.
- Produces: `PATCH /api/admin/products/:id`.
- Produces: `POST /api/admin/products/:id/variants`.
- Produces: `PATCH /api/admin/variants/:id`.
- Produces: `GET /api/admin/orders`.
- Produces: `GET /api/admin/orders/:id`.
- Produces: `PATCH /api/admin/orders/:id/status`.

- [ ] **Step 1: Write failing admin tests**

Create tests for:

```js
it('rejects customer access to admin dashboard with 403');
it('returns dashboard totals for admin');
it('creates and updates a product');
it('creates and updates a product variant');
it('lists all orders for admin');
it('moves order pending to confirmed to shipping to completed');
it('sets payment_status paid when order is completed');
it('rejects invalid order status transition with 400');
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd shoe-store/server
npm test -- admin.test.js
```

Expected: FAIL because admin routes do not exist.

- [ ] **Step 3: Implement product admin functions**

Required functions:

```js
async function createProduct(input) {}
async function updateProduct(id, input) {}
async function createVariant(productId, input) {}
async function updateVariant(id, input) {}
```

Validate name, slug, price, status, SKU, size, color, and nonnegative stock.

- [ ] **Step 4: Implement admin order functions**

Allowed transitions:

```text
pending -> confirmed
pending -> cancelled
confirmed -> shipping
confirmed -> cancelled
shipping -> completed
shipping -> cancelled
completed -> no changes
cancelled -> no changes
```

When status becomes `completed`, set `payment_status='paid'`.

- [ ] **Step 5: Wire admin routes**

Add:

```js
app.use('/api/admin', adminRoutes);
```

- [ ] **Step 6: Run admin tests**

Run:

```bash
cd shoe-store/server
npm test -- admin.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add shoe-store/server
git commit -m "feat: add admin management api"
```

---

### Task 7: AI Product Advisor API

**Files:**
- Create: `shoe-store/server/src/modules/ai/ai.routes.js`
- Create: `shoe-store/server/src/modules/ai/ai.service.js`
- Create: `shoe-store/server/test/ai.test.js`
- Modify: `shoe-store/server/src/app.js`

**Interfaces:**
- Produces: `POST /api/ai/chat`.
- Request: `{ "message": "..." }`.
- Response: `{ "answer": "...", "products": ProductCard[] }`.

- [ ] **Step 1: Write failing AI tests**

Create tests for:

```js
it('requires auth to use ai chat');
it('returns catalog recommendations for budget and size');
it('returns a helpful fallback when no product matches');
it('stores user and assistant messages');
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd shoe-store/server
npm test -- ai.test.js
```

Expected: FAIL because AI route does not exist.

- [ ] **Step 3: Implement deterministic product extraction**

Implement parsing helpers:

```js
function extractBudget(message) {}
function extractSize(message) {}
function extractGender(message) {}
function extractBrand(message) {}
function extractKeywords(message) {}
```

Examples:

- `"dưới 1 triệu"` -> max price `1000000`.
- `"size 42"` -> size `42`.
- `"nam"` -> gender `men`.
- `"nữ"` -> gender `women`.

- [ ] **Step 4: Implement advisor response**

Required behavior:

- Query matching products from PostgreSQL.
- If products exist, answer with short Vietnamese advice and up to 4 products.
- If none match, answer that no exact match exists and suggest widening filters.
- Store both user message and assistant answer in `ai_chat_messages`.

- [ ] **Step 5: Wire AI routes**

Add:

```js
app.use('/api/ai', aiRoutes);
```

- [ ] **Step 6: Run AI tests**

Run:

```bash
cd shoe-store/server
npm test -- ai.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add shoe-store/server
git commit -m "feat: add ai product advisor api"
```

---

### Task 8: Frontend API Client, Auth, and Layout

**Files:**
- Create: `shoe-store/client/src/api/client.js`
- Create: `shoe-store/client/src/auth/AuthContext.jsx`
- Create: `shoe-store/client/src/cart/CartContext.jsx`
- Create: `shoe-store/client/src/components/Layout.jsx`
- Create: `shoe-store/client/src/components/StatusBadge.jsx`
- Create: `shoe-store/client/src/pages/LoginPage.jsx`
- Create: `shoe-store/client/src/pages/RegisterPage.jsx`
- Modify: `shoe-store/client/src/App.jsx`
- Modify: `shoe-store/client/src/styles.css`
- Create: `shoe-store/client/test/App.test.jsx`

**Interfaces:**
- Produces: `apiClient.get/post/patch/delete`.
- Produces: `useAuth()` with `{ user, token, login, register, logout, isAdmin }`.
- Produces: `useCart()` with `{ cart, refreshCart, addItem, updateItem, removeItem }`.

- [ ] **Step 1: Write failing frontend auth tests**

Create tests for:

```jsx
it('renders navigation links');
it('logs in and stores the current user');
it('hides admin navigation for customer');
it('shows admin navigation for admin');
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd shoe-store/client
npm test -- App.test.jsx
```

Expected: FAIL because routes/context do not exist.

- [ ] **Step 3: Implement API client**

`apiClient` requirements:

```js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```

Methods:

```js
async function request(path, { method = 'GET', body, token } = {}) {}
```

Behavior:

- Send JSON body.
- Attach bearer token when present.
- Throw `Error(message)` from JSON error responses.

- [ ] **Step 4: Implement auth context and routes**

Routes:

```jsx
/
/products
/cart
/orders
/login
/register
/admin
```

Persist token in `localStorage` key `shoe_store_token`.

- [ ] **Step 5: Run frontend auth tests**

Run:

```bash
cd shoe-store/client
npm test -- App.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shoe-store/client
git commit -m "feat: add frontend auth shell"
```

---

### Task 9: Frontend Customer Shopping Flow

**Files:**
- Create: `shoe-store/client/src/components/ProductCard.jsx`
- Create: `shoe-store/client/src/components/AiAssistant.jsx`
- Create: `shoe-store/client/src/pages/HomePage.jsx`
- Create: `shoe-store/client/src/pages/ProductListPage.jsx`
- Create: `shoe-store/client/src/pages/ProductDetailPage.jsx`
- Create: `shoe-store/client/src/pages/CartPage.jsx`
- Create: `shoe-store/client/src/pages/CheckoutPage.jsx`
- Create: `shoe-store/client/src/pages/OrdersPage.jsx`
- Create: `shoe-store/client/src/pages/OrderDetailPage.jsx`
- Create: `shoe-store/client/test/customer-flow.test.jsx`
- Modify: `shoe-store/client/src/App.jsx`
- Modify: `shoe-store/client/src/styles.css`

**Interfaces:**
- Consumes: product, cart, order, and AI API endpoints from prior backend tasks.
- Produces: customer-facing pages from the spec.

- [ ] **Step 1: Write failing customer flow tests**

Create tests for:

```jsx
it('renders products from the API');
it('filters products by search keyword');
it('adds a selected variant to cart');
it('submits COD checkout');
it('renders order status tracking');
it('shows AI product recommendations');
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd shoe-store/client
npm test -- customer-flow.test.jsx
```

Expected: FAIL because pages are incomplete.

- [ ] **Step 3: Implement product pages**

Product list:

- Search input.
- Filters for brand, gender, size, color, and price range.
- Sort select.
- Product grid with image, name, price, brand, available sizes.

Product detail:

- Image gallery.
- Variant selector for size/color.
- Quantity input.
- Add to cart button.

- [ ] **Step 4: Implement cart and checkout pages**

Cart:

- Show items, variant labels, unit price, quantity, line total, subtotal.
- Quantity update and remove actions.

Checkout:

- Receiver name.
- Phone.
- Shipping address.
- Note.
- COD summary.
- Submit order and redirect to order detail.

- [ ] **Step 5: Implement order pages**

Orders list:

- Order code.
- Created date.
- Total.
- Order status badge.
- Payment status badge.

Order detail:

- Receiver/shipping data.
- Timeline for `pending`, `confirmed`, `shipping`, `completed`.
- Purchased item snapshots.

- [ ] **Step 6: Implement AI assistant**

UI behavior:

- Floating panel on customer pages.
- Input and send button.
- Shows answer text and recommended product cards.
- If user is not logged in, show login/register links instead of sending API call.

- [ ] **Step 7: Run customer flow tests**

Run:

```bash
cd shoe-store/client
npm test -- customer-flow.test.jsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add shoe-store/client
git commit -m "feat: add customer shopping flow"
```

---

### Task 10: Frontend Admin Flow

**Files:**
- Create: `shoe-store/client/src/pages/admin/AdminLayout.jsx`
- Create: `shoe-store/client/src/pages/admin/AdminDashboardPage.jsx`
- Create: `shoe-store/client/src/pages/admin/AdminProductsPage.jsx`
- Create: `shoe-store/client/src/pages/admin/AdminProductFormPage.jsx`
- Create: `shoe-store/client/src/pages/admin/AdminOrdersPage.jsx`
- Create: `shoe-store/client/src/pages/admin/AdminOrderDetailPage.jsx`
- Create: `shoe-store/client/test/admin-flow.test.jsx`
- Modify: `shoe-store/client/src/App.jsx`
- Modify: `shoe-store/client/src/styles.css`

**Interfaces:**
- Consumes: admin API endpoints from Task 6.
- Produces: admin dashboard, product management, variant management, and order status management pages.

- [ ] **Step 1: Write failing admin flow tests**

Create tests for:

```jsx
it('redirects non-admin users away from admin pages');
it('renders dashboard totals');
it('renders product admin table');
it('submits product create form');
it('renders admin order list');
it('updates order status to completed');
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd shoe-store/client
npm test -- admin-flow.test.jsx
```

Expected: FAIL because admin pages are incomplete.

- [ ] **Step 3: Implement admin layout and dashboard**

Admin layout:

- Sidebar links to dashboard, products, orders.
- Header shows admin user.
- Guard rejects non-admin users.

Dashboard:

- Product count.
- Pending order count.
- Completed order count.
- Revenue from paid orders.

- [ ] **Step 4: Implement product admin pages**

Product management:

- Product table with status, price, stock summary.
- Create/edit form for product fields.
- Variant section for SKU, size, color, stock.

- [ ] **Step 5: Implement order admin pages**

Order management:

- Order table with customer, total, order status, payment status.
- Detail page with status transition buttons.
- Completing order refreshes `payment_status` to `paid`.

- [ ] **Step 6: Run admin flow tests**

Run:

```bash
cd shoe-store/client
npm test -- admin-flow.test.jsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add shoe-store/client
git commit -m "feat: add admin frontend"
```

---

### Task 11: End-to-End Local Verification and Docs

**Files:**
- Modify: `shoe-store/README.md`
- Modify: `shoe-store/package.json`
- Modify: files needed to fix issues found by verification only

**Interfaces:**
- Produces: documented local setup and demo credentials.
- Produces: verified local URLs.

- [ ] **Step 1: Update README**

README must include:

```markdown
## Local URLs

- Frontend: http://161.248.81.90:5173
- Backend: http://161.248.81.90:5000

## Demo Accounts

- Admin: admin@shoestore.local / Admin123!
- Customer: customer@shoestore.local / Customer123!
```

Include setup commands:

```bash
cp server/.env.example server/.env
npm install
npm run db:setup
npm run dev
```

- [ ] **Step 2: Run backend test suite**

Run:

```bash
cd shoe-store/server
npm test
```

Expected: all backend tests pass.

- [ ] **Step 3: Run frontend test suite**

Run:

```bash
cd shoe-store/client
npm test
```

Expected: all frontend tests pass.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd shoe-store
npm run build
```

Expected: Vite build passes.

- [ ] **Step 5: Start local app**

Run:

```bash
cd shoe-store
npm run dev
```

Expected:

- API logs `API listening on http://0.0.0.0:5000`.
- Vite logs a network URL on port `5173`.

- [ ] **Step 6: Verify health endpoint**

Run:

```bash
curl -i http://127.0.0.1:5000/api/health
```

Expected:

```text
HTTP/1.1 200 OK
content-type: application/json
```

Body:

```json
{"ok":true,"service":"shoe-store-api"}
```

- [ ] **Step 7: Manual browser verification**

Verify:

- Customer can login with seeded account.
- Product list loads.
- Product detail loads.
- Customer can add a variant to cart.
- Customer can checkout COD.
- Customer can view created order.
- Admin can login.
- Admin can move order to completed.
- Completed order shows `payment_status='paid'`.
- AI assistant returns product recommendations.

- [ ] **Step 8: Commit docs and verification fixes**

```bash
git add shoe-store
git commit -m "docs: document shoe store local setup"
```

---

## Self-Review Notes

- Spec coverage: scaffold, database, auth, catalog, cart, COD orders, admin, AI advisor, frontend customer flow, frontend admin flow, local URLs, and verification are all covered by tasks.
- Placeholder scan: no unresolved marker text or deferred implementation steps remain.
- Type consistency: routes, roles, statuses, and local ports match the approved spec.
