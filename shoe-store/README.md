# Shoe Store

Local shoe store MVP scaffold with a React + Vite client and Node.js/Express API.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL client tools
- A PostgreSQL database URL in `server/.env` or exported as `DATABASE_URL`
- Optional: `OPENAI_API_KEY` in `server/.env` for AI-ranked product advice
- Optional: `GEMINI_API_KEY` in `server/.env` or deployment environment for RAG embeddings and grounded answers

If `DATABASE_URL` is not set, the API starts with an in-memory demo
database loaded from `database/schema.sql` and `database/seed.sql`. This
is useful for quick local review, but data resets when the server restarts.
If `OPENAI_API_KEY` is not set, product advice still works with the
backend's local filtered fallback response.
Do not commit Gemini or OpenAI keys. Gemini keys belong only in
`server/.env` for local development or in the backend deployment
environment; the frontend must never receive or store `GEMINI_API_KEY`.

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
