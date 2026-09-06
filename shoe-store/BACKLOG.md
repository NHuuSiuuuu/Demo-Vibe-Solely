# Backlog

This file tracks future work that is useful but not required for the current MVP.

## High Priority

- Add safe database migrations so future schema changes do not require rerunning `npm run db:setup`.
- Add image upload for product photos instead of placeholder image URLs.
- Add admin customer management for viewing customers and their order history.
- Add order cancellation rules for customers and admins.
- Add email notifications for account registration and order status changes.
- Add production deployment configuration for frontend, backend, and managed PostgreSQL.

## Medium Priority

- Add product reviews after completed orders.
- Add discount codes and promotions.
- Add product sorting by price, newest, featured, and stock availability.
- Add richer admin analytics for revenue, top products, low stock, and order status counts.
- Add audit-friendly order status history.
- Add pagination for product, order, and admin lists.

## Later

- Add online payment in addition to COD.
- Add wishlist or favorites.
- Add product recommendations from browsing and order history.
- Add inventory import/export via CSV.
- Add customer support messaging.
- Add deployment monitoring, error tracking, and database backup documentation.

## Technical Debt

- Replace the destructive setup script with separate migration and seed commands.
- Add a dedicated test database setup path for PostgreSQL-backed integration tests.
- Move local development secrets out of documentation and into environment-specific setup notes.
- Add API rate limiting and stronger auth configuration before public production release.
