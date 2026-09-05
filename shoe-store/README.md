# Shoe Store

Local shoe store MVP scaffold with a React + Vite client and Node.js/Express API.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL client tools
- A PostgreSQL database URL exported as `DATABASE_URL`

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

## Scripts

```bash
npm run dev
npm run test
npm run build
npm run db:setup
```

- Health check: `GET /api/health`
