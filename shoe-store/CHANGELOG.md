# Changelog

All notable project changes are tracked here so product, code, database, and deployment decisions are easy to review later.

## Unreleased

### Added

- Created the shoe store MVP with React, Vite, Node.js, Express, and PostgreSQL support.
- Added customer authentication with email/password, JWT sessions, and customer/admin roles.
- Added product catalog, product detail pages, filters, search, product images, sizes, colors, and stock-backed variants.
- Added cart management, COD checkout, order creation, customer order history, and order detail views.
- Added admin dashboard flows for managing products, variants, inventory, and order status.
- Added AI product advisor backed by catalog data, with a fallback response when no OpenAI API key is configured.
- Added database schema and seed data for users, products, images, variants, carts, orders, order items, and AI chat messages.
- Added local setup documentation and demo accounts.
- Added PostgreSQL local database setup on the remote development server.

### Changed

- Added an in-memory demo database fallback for local review when `DATABASE_URL` is not configured.
- Updated backend database access so the app can run against either PostgreSQL or the demo fallback.
- Improved admin variant inventory editing after implementation review.

### Verified

- Backend test suite passed during MVP implementation.
- Frontend test suite passed during MVP implementation.
- Frontend production build passed during MVP implementation.
- Local PostgreSQL connection was verified by creating a customer through the API and reading it from the `users` table.

## 2026-09-05

### Added

- Wrote MVP design spec for authenticated shoe store flows.
- Wrote implementation plan covering scaffold, database, auth, product API, cart/orders, admin flows, AI advisor, frontend flows, verification, and docs.
