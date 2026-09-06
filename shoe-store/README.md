# Shoe Store

Local shoe store MVP scaffold with a React + Vite client and Node.js/Express API.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL client tools
- A PostgreSQL database URL in `server/.env` or exported as `DATABASE_URL`

If `DATABASE_URL` is not set, the API starts with an in-memory demo
database loaded from `database/schema.sql` and `database/seed.sql`. This
is useful for quick local review, but data resets when the server restarts.

## Local URLs

- Frontend: http://161.248.81.90:5173
- Backend: http://161.248.81.90:5000

## Demo Accounts

- Admin: admin@shoestore.local / Admin123!
- Customer: customer@shoestore.local / Customer123!

## Setup

```bash
cp server/.env.example server/.env
npm install
npm run db:setup
npm run dev
```

For quick UI review without PostgreSQL, skip `server/.env` and
`npm run db:setup`, then run:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run test
npm run build
npm run db:setup
```

- Health check: `GET /api/health`
