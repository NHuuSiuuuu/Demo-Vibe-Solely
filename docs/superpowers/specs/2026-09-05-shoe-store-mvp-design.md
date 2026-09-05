# Shoe Store MVP Design

## Summary

Build a local-first shoe store web application with React, Node.js/Express, and PostgreSQL. Customers can search, view, buy shoes with cash on delivery, and track their orders. Admins can manage products, stock, and order status. The app includes an AI assistant that helps customers search and choose products from the catalog.

The project will live in a separate `shoe-store/` folder under the current workspace so it does not affect existing unrelated files.

## Goals

- Provide a usable shopping flow from product discovery to order tracking.
- Support customer and admin authentication.
- Keep order, payment, and stock states explicit and traceable.
- Run locally with a browser-accessible frontend URL and backend API URL.
- Add a practical AI advisor that recommends products based on catalog data.

## Non-Goals

- Online payment gateway integration in the first version.
- Production deployment, CI, or external hosting.
- Full RAG/vector search for AI.
- Multi-vendor marketplace features.
- Advanced warehouse, coupon, review, or return workflows.

## Architecture

The app will use a simple monorepo:

```text
shoe-store/
  client/       React + Vite + React Router
  server/       Node.js + Express
  database/     PostgreSQL schema and seed data
  README.md
```

Runtime layout:

```text
Browser -> React client -> Express API -> PostgreSQL
                         -> AI service fallback/catalog advisor
```

The frontend will call the backend through `VITE_API_URL`. For local testing:

- Frontend: `http://161.248.81.90:5173`
- Backend: `http://161.248.81.90:5000`

Both servers must bind to `0.0.0.0` so the user can open the frontend from another machine if the host network allows it.

## Authentication and Authorization

Authentication will be owned by the Express backend.

User roles:

- `customer`: browse products, manage own cart, place COD orders, view own orders.
- `admin`: manage products, variants/stock, and all orders.

Auth behavior:

- Users register with name, email, and password.
- Passwords are hashed with `bcrypt`.
- Login returns a signed JWT.
- Protected API routes require `Authorization: Bearer <token>`.
- Admin routes require role `admin`.
- Seed data will include one admin account and one customer account for local testing.

## Catalog and Search

Customers can:

- View featured/new products on the home page.
- Browse all shoes.
- Search by keyword.
- Filter by brand, category, gender, size, color, and price range.
- Sort by newest, price low to high, and price high to low.
- Open a product detail page with images, description, sizes, colors, price, and available stock.

The first version will use normal SQL filtering. No external search engine is required.

## Cart and Checkout

Cart rules:

- Cart items are tied to a logged-in customer.
- Each cart item references a specific product variant, including size and color.
- Quantity cannot exceed available stock.
- Users can update quantity or remove items.

Checkout rules:

- User enters receiver name, phone number, shipping address, and optional note.
- Payment method is fixed to cash on delivery.
- The backend creates an order and order items from the cart.
- The cart is cleared after successful order creation.
- Stock is reserved/decremented when the order is created.

## Order and Payment States

Order status:

- `pending`: customer created the order.
- `confirmed`: admin accepted the order.
- `shipping`: order is being delivered.
- `completed`: customer received the order.
- `cancelled`: order was cancelled.

Payment status:

- `unpaid`: COD order has not been collected yet.
- `paid`: COD money collected when the order is completed.

COD flow:

```text
checkout -> order_status=pending, payment_status=unpaid
admin confirms -> order_status=confirmed
admin ships -> order_status=shipping
admin completes -> order_status=completed, payment_status=paid
admin cancels -> order_status=cancelled
```

Customers can view only their own orders. Admins can view and update all orders.

## Admin Features

Admin pages:

- Dashboard summary: product count, pending orders, completed orders, revenue from paid orders.
- Product management: create, update, hide/show products.
- Variant management: size, color, SKU, stock.
- Order management: list orders, inspect order detail, update status.

Admin updates must be validated by the backend. The frontend should not be trusted for role or state enforcement.

## AI Product Advisor

The AI assistant will be a customer-facing chat panel. It helps users find shoes based on their needs, budget, size, gender, brand, or use case.

Examples:

- "Tôi cần giày chạy bộ nam dưới 1 triệu size 42"
- "Có đôi nào màu trắng đi học không?"
- "Tư vấn giày Nike cho nữ"

Implementation:

- Backend receives the user question.
- Backend queries relevant products from PostgreSQL using keyword and filter extraction.
- Backend returns a helpful answer with recommended product cards.
- If an OpenAI API key is configured, the backend can use it to produce more natural responses.
- If no API key is configured, the backend uses a deterministic catalog-based fallback response.

This keeps the local demo usable without requiring a paid AI key.

## Database Model

Core tables:

- `users`
  - id, name, email, password_hash, role, created_at, updated_at
- `products`
  - id, name, slug, brand, category, gender, description, price, status, created_at, updated_at
- `product_images`
  - id, product_id, image_url, alt_text, sort_order
- `product_variants`
  - id, product_id, sku, size, color, stock_quantity
- `carts`
  - id, user_id, created_at, updated_at
- `cart_items`
  - id, cart_id, variant_id, quantity
- `orders`
  - id, user_id, order_code, receiver_name, phone, shipping_address, note, subtotal, payment_method, payment_status, order_status, created_at, updated_at
- `order_items`
  - id, order_id, product_id, variant_id, product_name, size, color, unit_price, quantity, total_price
- `ai_chat_messages`
  - id, user_id, role, content, metadata_json, created_at

Important constraints:

- User emails are unique.
- Product slugs are unique.
- Variant SKUs are unique.
- Quantities and stock cannot be negative.
- Order snapshots store product name, size, color, and price at purchase time so historical orders do not change when products are edited later.

## API Surface

Public:

- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:slug`

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Customer:

- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:id`
- `DELETE /api/cart/items/:id`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/ai/chat`

Admin:

- `GET /api/admin/dashboard`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `POST /api/admin/products/:id/variants`
- `PATCH /api/admin/variants/:id`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id/status`

## Frontend Pages

Customer pages:

- `/`: home and featured shoes
- `/products`: product list, search, filters, sort
- `/products/:slug`: product detail
- `/cart`: cart
- `/checkout`: COD checkout
- `/orders`: user's order history
- `/orders/:id`: order detail and tracking
- `/login`: login
- `/register`: register

Admin pages:

- `/admin`: dashboard
- `/admin/products`: product management
- `/admin/products/new`: create product
- `/admin/products/:id`: edit product and variants
- `/admin/orders`: order management
- `/admin/orders/:id`: order detail

UI should be practical and commerce-focused: searchable product grid, clear cart totals, visible order status badges, and dense but readable admin tables.

## Error Handling

Backend:

- Return JSON errors with consistent shape: `{ "message": "...", "details": ... }`.
- Validate request bodies.
- Return `401` for missing/invalid auth.
- Return `403` for wrong role.
- Return `404` for missing resources.
- Return `409` for stock conflicts or duplicate email.

Frontend:

- Show inline form validation.
- Show toast or alert-style messages for API failures.
- Keep cart/order state consistent after successful mutations.
- Redirect unauthenticated users to login for protected pages.

## Local Development

Expected commands:

```bash
cd shoe-store
npm install
npm run db:setup
npm run dev
```

`npm run dev` should start both frontend and backend. PostgreSQL can be provided by Docker Compose if available, otherwise the README will document the required local `DATABASE_URL`.

## Testing and Verification

Backend tests:

- Auth register/login/me.
- Product list/detail filters.
- Cart add/update/remove with stock checks.
- COD order creation.
- Admin order status transitions.
- Role protection.
- AI fallback response.

Frontend verification:

- Build succeeds.
- Main pages render.
- User can register/login, add product to cart, checkout, and view order.
- Admin can login and update order status.

Manual local checks:

- `GET /api/health` returns JSON.
- Frontend opens at the provided local IP.
- Customer flow works end to end.
- Admin flow updates order state and payment status correctly.

## Open Questions

No unresolved product decisions remain for MVP. The first implementation should use:

- React + Vite
- Express
- PostgreSQL
- Backend-owned JWT auth
- COD only
- Local-first setup
- AI advisor with fallback when no OpenAI API key exists
